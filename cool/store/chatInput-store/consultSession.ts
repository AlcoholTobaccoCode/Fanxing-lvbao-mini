import { ref } from "vue";
import { config } from "@/config";
import { useStore } from "@/cool";
import { RecommendLawyers, type RecommendLawyerItem } from "@/api/consult";
import { SaveMessages, type SaveMessagesPayload } from "@/api/history-chat";
import { generateUUID } from "@/utils/util";
import { createSseDecoder } from "@/cool/utils/sse-decoder";
import type { ChatLaunchPayload } from "./flow";
import type { Tools } from "@/cool/types/chat-input";
import {
	GetLawCardDetail,
	GetCaseCardDetail,
	type LawDetailResponse,
	type CaseDetailResponse
} from "@/api/references";
import { createModelSessionId } from "@/utils/assetsConfig";

// ============ 全局缓存类型定义 ============
/** 法条详情缓存 Map，以 lawId 为 key */
type LawDetailsMap = Map<string, LawDetailResponse>;
/** 案例详情缓存 Map，以 caseNo（案号）为 key */
type CaseDetailsMap = Map<string, CaseDetailResponse>;

/** 缓存最大条目数，防止内存泄漏 */
const MAX_CACHE_SIZE = 30;

export interface ConsultMessageReferences {
	searchList?: Array<{
		hostName?: string;
		hostLogo?: string;
		indexId?: number;
		time?: string;
		title?: string;
		body?: string;
		url?: string;
	}>;
	lawList?: Array<{
		lawId?: string;
		lawItemId?: string;
	}>;
	caseList?: string[];
	lawDetails?: LawDetailResponse[];
	caseDetails?: CaseDetailResponse[];
	// 加载状态
	loadingLaw?: boolean;
	loadingCase?: boolean;
}

export interface ConsultMessage {
	role: "user" | "system";
	content: string;
	// 是否由语音输入转写而来，用于前端以语音气泡样式展示
	fromVoice?: boolean;
	// 语音播放地址（可选）
	voiceUrl?: string;
	// 语音时长（秒，可选）
	voiceLength?: number;
	// 深度思考过程（如果开启了深度思考），仅对 AI 消息有效
	deepThink?: string;
	// 深度思考开始时间戳（毫秒）
	deepThinkStartTime?: number;
	// 深度思考结束时间戳（毫秒）
	deepThinkEndTime?: number;
	// 是否包含推荐律师信息
	haveRecommendLawyer?: boolean;
	// 推荐律师详细信息列表
	recommendedLawyers?: RecommendLawyerItem[];
	// AI 引用列表（互联网搜索、法条、案例）
	references?: ConsultMessageReferences;
}

export interface ConsultStreamHooks {
	onTextChunk?: (chunk: string) => void;
}

export class ConsultSessionStore {
	messages = ref<ConsultMessage[]>([]);
	sessionId = ref<string | null>(null);
	loading = ref(false);
	// 推荐律师加载中状态
	recommendLoading = ref(false);
	// 当前这轮流式回答的阶段状态文案，例如"正在思考中…"、"正在为您检索相关司法判例…"。
	streamStatus = ref<string | null>(null);
	// 深度思考过程文本（如果开启深度思考）。暂时只存不展示，后续用于"思考过程"折叠面板。
	deepThinkContent = ref<string>("");
	// 当前正在进行的请求任务，用于支持中断
	private currentRequestTask: any = null;
	// 中断标志，用于阻止已在队列中的数据继续处理
	private isAborted = false;
	// 当前请求ID，用于区分不同请求，防止旧请求回调影响新请求
	private currentRequestId = 0;

	//#region 会话级全局缓存，数据按需加载

	/** 法条详情缓存，以 lawId 为 key */
	private lawDetailsMap: LawDetailsMap = new Map();
	/** 案例详情缓存，以 caseNo 为 key */
	private caseDetailsMap: CaseDetailsMap = new Map();

	/**
	 * 限制缓存大小，超出时删除最早的条目（简易 LRU）
	 */
	private limitCacheSize<K, V>(map: Map<K, V>, maxSize: number) {
		if (map.size > maxSize) {
			const keysToDelete = Array.from(map.keys()).slice(0, map.size - maxSize);
			for (const key of keysToDelete) {
				map.delete(key);
			}
		}
	}

	// 缓存操作方法

	/**
	 * 从缓存获取法条详情
	 * @param lawId 法条 ID
	 */
	getLawDetailFromCache(lawId: string): LawDetailResponse | undefined {
		return this.lawDetailsMap.get(lawId);
	}

	/**
	 * 从缓存获取案例详情
	 * @param caseNo 案号
	 */
	getCaseDetailFromCache(caseNo: string): CaseDetailResponse | undefined {
		return this.caseDetailsMap.get(caseNo);
	}

	/**
	 * 批量获取法条详情（优先缓存，缺失的请求后更新缓存）
	 * 保证返回顺序与输入列表一致
	 * @param lawList 法条列表
	 * @returns 法条详情数组（按照输入顺序）
	 */
	async fetchLawDetailsWithCache(
		lawList: Array<{ lawId?: string; lawItemId?: string }>
	): Promise<LawDetailResponse[]> {
		if (!lawList || lawList.length === 0) return [];

		// 使用 Map 按 lawId 存储结果
		const resultMap = new Map<string, LawDetailResponse>();
		const needFetch: Array<{ lawId: string; lawItemId: string }> = [];

		// 1. 从缓存获取已有数据，收集缺失项
		for (const item of lawList) {
			if (!item.lawId) continue;
			const cached = this.lawDetailsMap.get(item.lawId);
			if (cached) {
				resultMap.set(item.lawId, cached);
			} else {
				needFetch.push({
					lawId: item.lawId,
					lawItemId: item.lawItemId || ""
				});
			}
		}

		// 2. 请求缺失数据
		if (needFetch.length > 0) {
			try {
				const res = await GetLawCardDetail(needFetch);
				const fetchedData = res?.data ?? res ?? [];
				if (Array.isArray(fetchedData)) {
					for (const detail of fetchedData) {
						// 更新缓存和结果映射
						this.lawDetailsMap.set(detail.lawId, detail);
						resultMap.set(detail.lawId, detail);
					}
					// 限制缓存大小
					this.limitCacheSize(this.lawDetailsMap, MAX_CACHE_SIZE);
				}
			} catch (err) {
				console.error("[ConsultSession] 获取法条详情失败", err);
			}
		}

		// 3. 按照输入顺序返回结果
		const result: LawDetailResponse[] = [];
		for (const item of lawList) {
			if (item.lawId) {
				const detail = resultMap.get(item.lawId);
				if (detail) {
					result.push(detail);
				}
			}
		}

		return result;
	}

	/**
	 * 批量获取案例详情（优先缓存，缺失的请求后更新缓存）
	 * 保证返回顺序与输入列表一致
	 * @param caseList 案号列表
	 * @returns 案例详情数组（按照输入顺序）
	 */
	async fetchCaseDetailsWithCache(caseList: string[]): Promise<CaseDetailResponse[]> {
		if (!caseList || caseList.length === 0) return [];

		// 使用 Map 按 caseNo 存储结果
		const resultMap = new Map<string, CaseDetailResponse>();
		const needFetch: string[] = [];

		// 1. 从缓存获取已有数据，收集缺失项
		for (const caseNo of caseList) {
			const cached = this.caseDetailsMap.get(caseNo);
			if (cached) {
				resultMap.set(caseNo, cached);
			} else {
				needFetch.push(caseNo);
			}
		}

		// 2. 请求缺失数据
		if (needFetch.length > 0) {
			try {
				const res = await GetCaseCardDetail(needFetch);
				const fetchedData = res?.data ?? res ?? [];
				if (Array.isArray(fetchedData)) {
					for (const detail of fetchedData) {
						const caseNo = detail.caseDomain?.caseNo;
						if (caseNo) {
							// 更新缓存和结果映射
							this.caseDetailsMap.set(caseNo, detail);
							resultMap.set(caseNo, detail);
						}
					}
					// 限制缓存大小
					this.limitCacheSize(this.caseDetailsMap, MAX_CACHE_SIZE);
				}
			} catch (err) {
				console.error("[ConsultSession] 获取案例详情失败", err);
			}
		}

		// 3. 按照输入顺序返回结果
		const result: CaseDetailResponse[] = [];
		for (const caseNo of caseList) {
			const detail = resultMap.get(caseNo);
			if (detail) {
				result.push(detail);
			}
		}

		return result;
	}

	/**
	 * 获取单个法条详情（用于弹窗，优先从缓存获取）
	 * @param lawId 法条 ID
	 * @param lawItemId 法条项目 ID（可选）
	 */
	async fetchSingleLawDetail(
		lawId: string,
		lawItemId?: string
	): Promise<LawDetailResponse | null> {
		// 优先从缓存获取
		const cached = this.lawDetailsMap.get(lawId);
		if (cached) return cached;

		// 缓存未命中，请求接口
		try {
			const res = await GetLawCardDetail([{ lawId, lawItemId: lawItemId || "" }]);
			const data = res?.data ?? res ?? [];
			if (Array.isArray(data) && data.length > 0) {
				const detail = data[0];
				// 更新缓存
				this.lawDetailsMap.set(detail.lawId, detail);
				this.limitCacheSize(this.lawDetailsMap, MAX_CACHE_SIZE);
				return detail;
			}
		} catch (err) {
			console.error("[ConsultSession] 获取单个法条详情失败", err);
		}
		return null;
	}

	/**
	 * 获取单个案例详情（用于弹窗，优先从缓存获取）
	 * @param caseNo 案号
	 */
	async fetchSingleCaseDetail(caseNo: string): Promise<CaseDetailResponse | null> {
		// 优先从缓存获取
		const cached = this.caseDetailsMap.get(caseNo);
		if (cached) return cached;

		// 缓存未命中，请求接口
		try {
			const res = await GetCaseCardDetail([caseNo]);
			const data = res?.data ?? res ?? [];
			if (Array.isArray(data) && data.length > 0) {
				const detail = data[0];
				// 更新缓存
				const cNo = detail.caseDomain?.caseNo;
				if (cNo) {
					this.caseDetailsMap.set(cNo, detail);
					this.limitCacheSize(this.caseDetailsMap, MAX_CACHE_SIZE);
				}
				return detail;
			}
		} catch (err) {
			console.error("[ConsultSession] 获取单个案例详情失败", err);
		}
		return null;
	}

	/**
	 * 按需加载某条消息的引用详情（供引用面板展开时调用）
	 * @param msgIndex 消息索引
	 * @param type 加载类型：'law' | 'case' | 'all'
	 */
	async loadReferencesDetailOnDemand(
		msgIndex: number,
		type: "law" | "case" | "all" = "all"
	): Promise<void> {
		const msg = this.messages.value[msgIndex];
		if (!msg || !msg.references) return;

		const refs = msg.references;
		const promises: Promise<void>[] = [];

		const updateMessage = (updater: (refs: ConsultMessageReferences) => void) => {
			const currentMsg = this.messages.value[msgIndex];
			if (currentMsg?.references) {
				updater(currentMsg.references);
				this.messages.value = [...this.messages.value];
			}
		};

		// 加载法规详情
		if (
			(type === "law" || type === "all") &&
			refs.lawList?.length &&
			!refs.lawDetails?.length &&
			!refs.loadingLaw
		) {
			updateMessage((r) => (r.loadingLaw = true));

			promises.push(
				this.fetchLawDetailsWithCache(refs.lawList)
					.then((lawDetails) => {
						updateMessage((r) => {
							r.lawDetails = lawDetails;
							r.loadingLaw = false;
						});
					})
					.catch(() => {
						updateMessage((r) => {
							r.lawDetails = [];
							r.loadingLaw = false;
						});
					})
			);
		}

		// 加载案例详情
		if (
			(type === "case" || type === "all") &&
			refs.caseList?.length &&
			!refs.caseDetails?.length &&
			!refs.loadingCase
		) {
			updateMessage((r) => (r.loadingCase = true));

			promises.push(
				this.fetchCaseDetailsWithCache(refs.caseList)
					.then((caseDetails) => {
						updateMessage((r) => {
							r.caseDetails = caseDetails;
							r.loadingCase = false;
						});
					})
					.catch(() => {
						updateMessage((r) => {
							r.caseDetails = [];
							r.loadingCase = false;
						});
					})
			);
		}

		await Promise.all(promises);
	}

	//#endregion

	initFromLaunch(launch: ChatLaunchPayload) {
		this.messages.value = [];
		this.sessionId.value = null;
	}

	private buildSessionForSave(sessionId: string, msgList?: ConsultMessage[]) {
		const list = msgList || this.messages.value;
		const firstUserMsg = list.find((m) => m.role === "user");
		const rawTitle = firstUserMsg?.content || "新对话";
		const title = rawTitle.length <= 30 ? rawTitle : rawTitle.slice(0, 30) + "...";
		const now = Date.now();
		const date = new Date(now);
		const pad = (n: number) => n.toString().padStart(2, "0");
		// 完整日期时间格式：YYYY-MM-DD HH:mm:ss
		const dateTimeStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
			date.getDate()
		)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

		const mappedMessages = list.map((m) => {
			// 计算思考用时（秒）
			let thinkingTime: number | undefined;
			if (m.deepThinkEndTime && m.deepThinkStartTime) {
				thinkingTime = Math.round((m.deepThinkEndTime - m.deepThinkStartTime) / 1000);
			}

			// ========== 过滤 references：不保存 lawDetails/caseDetails，searchList 删除 body ==========
			let filteredReferences: any = undefined;
			if (m.references) {
				filteredReferences = {
					// 保留 lawList、caseList
					lawList: m.references.lawList,
					caseList: m.references.caseList,
					// 联网搜索：删除 body 字段
					searchList: m.references.searchList?.map((item) => {
						const { body, ...rest } = item;
						return rest;
					})
					// 注意：不保存 lawDetails、caseDetails、loadingLaw、loadingCase
				};
			}

			return {
				id: generateUUID(),
				content: m.content,
				role: m.role,
				timestamp: dateTimeStr,
				deepThink: m.deepThink,
				thinkingTime,
				references: filteredReferences,
				haveRecommendLawyer: m.haveRecommendLawyer,
				recommendedLawyers: m.recommendedLawyers,
				// 语音消息
				voice: m.voiceUrl,
				voiceLength: m.voiceLength
			};
		});

		return {
			id: sessionId,
			title,
			messages: mappedMessages,
			createdAt: now,
			updatedAt: now
		} as Record<string, any>;
	}

	private async saveCurrentSessionSnapshot() {
		try {
			const { user } = useStore();
			const userId = (user as any)?.info?.value?.id as number | undefined;
			if (!this.sessionId.value || !userId) {
				return;
			}

			const session = this.buildSessionForSave(this.sessionId.value);
			const payload: SaveMessagesPayload = {
				user_id: userId,
				session_id: this.sessionId.value,
				message: session
			};

			await SaveMessages(payload);
		} catch (err) {
			console.error("[ConsultSession] 保存会话失败", err);
		}
	}

	async sendTextQuestion(
		text: string,
		tools: Tools,
		hooks?: ConsultStreamHooks,
		options?: { fromVoice?: boolean; voiceUrl?: string; voiceLength?: number }
	) {
		const content = text.trim();
		if (!content || this.loading.value) return;

		// 首轮发送时生成 sessionId，后续复用
		if (!this.sessionId.value) {
			this.sessionId.value = createModelSessionId("consult");
		}

		// 开启新一轮咨询前，重置流式状态与思考内容
		this.streamStatus.value = null;
		this.deepThinkContent.value = "";
		this.isAborted = false;
		// 生成新的请求ID，使旧请求的回调失效
		const requestId = ++this.currentRequestId;

		// 先追加一条用户消息
		this.messages.value.push({
			role: "user",
			content,
			fromVoice: !!options?.fromVoice,
			voiceUrl: options?.voiceUrl,
			voiceLength: options?.voiceLength
		});

		// 1. 用户点击问题进入聊天页时保存一次
		await this.saveCurrentSessionSnapshot();

		const onlineSearch = tools?.some((t) => t.text === "联网搜索" && t.enable);
		const deepThink = tools?.some((t) => t.text === "深度思考" && t.enable);

		const payload = {
			deepThink: !!deepThink,
			onlineSearch: !!onlineSearch,
			messages: this.messages.value.map((m) => ({
				role: m.role === "user" ? "user" : "system",
				content: m.content
			}))
		};

		// AI 回复占位
		this.messages.value.push({ role: "system", content: "" });
		const aiMsg = this.messages.value[this.messages.value.length - 1];

		this.loading.value = true;

		try {
			const { user } = useStore();

			const processSseLine = (rawLine: string) => {
				// 检查是否已中断或请求ID不匹配（说明是旧请求）
				if (this.isAborted || requestId !== this.currentRequestId) return;

				const line = rawLine.trim();
				if (!line) {
					return;
				}

				let jsonStr: string | null = null;

				if (line.startsWith("data:")) {
					const payload = line.slice(5).trim();
					if (!payload || payload === "[DONE]") {
						return;
					}
					jsonStr = payload;
				} else if (line.startsWith("{") || line.startsWith("[")) {
					jsonStr = line;
				} else {
					return;
				}

				try {
					let evt: {
						contents?: {
							id?: string;
							contentType?: string;
							content?: string;
							status?: string;
							searchList?: any[];
							lawList?: any[];
							caseList?: any[];
						}[];
					};

					try {
						const level1 = JSON.parse(jsonStr);

						const level2Str =
							typeof level1 === "string"
								? level1.replace(/^data:/, "")
								: JSON.stringify(level1);
						evt = JSON.parse(level2Str);

						if (typeof evt.contents === "string") {
							evt.contents = JSON.parse(evt.contents);
						}
					} catch {
						evt = JSON.parse(jsonStr);
					}

					const contents = evt.contents || [];

					// 原始正文片段
					const textChunkRaw = contents
						.filter((c) => c.contentType === "text" && typeof c.content === "string")
						.map((c) => c.content as string)
						.join("");

					// 深度思考过程片段（如果有）
					const deepThinkChunk = contents
						.filter(
							(c) => c.contentType === "deepThink" && typeof c.content === "string"
						)
						.map((c) => c.content as string)
						.join("");

					// 当前阶段状态文案：优先取带 status 的 text 内容，其次任意带 status 的内容
					const statusHolder =
						contents.find((c) => c.contentType === "text" && c.status) ||
						contents.find((c) => c.status);
					const statusText = (statusHolder?.status || "") as string;

					// 检测是否包含推荐律师标记
					const hasRecommendMarker =
						textChunkRaw.includes("<推荐律师>") ||
						textChunkRaw.includes("正在为您推荐律师...");

					// 清理推荐律师提示文案：
					let textChunk = textChunkRaw.replace(/<推荐律师>/g, "");

					if (textChunk) {
						aiMsg.content = textChunk;
						hooks?.onTextChunk?.(textChunk);
					}

					if (deepThinkChunk) {
						// 首次接收到深度思考内容时，记录开始时间
						if (!aiMsg.deepThinkStartTime) {
							aiMsg.deepThinkStartTime = Date.now();
						}
						(aiMsg as any).deepThink = deepThinkChunk;
						this.deepThinkContent.value = deepThinkChunk;
					}

					if (statusText) {
						this.streamStatus.value = statusText;
					}

					// 如检测到推荐律师标记，则在当前 AI 消息上打标记，供流结束后触发推荐接口
					if (hasRecommendMarker) {
						(aiMsg as any).haveRecommendLawyer = true;
					}

					// 解析并保存 references（searchList、lawList、caseList）
					for (const c of contents) {
						if (c.searchList && Array.isArray(c.searchList) && c.searchList.length) {
							if (!aiMsg.references) {
								aiMsg.references = {};
							}
							aiMsg.references.searchList = c.searchList;
						}
						if (c.lawList && Array.isArray(c.lawList) && c.lawList.length) {
							if (!aiMsg.references) {
								aiMsg.references = {};
							}
							aiMsg.references.lawList = c.lawList;
						}
						if (c.caseList && Array.isArray(c.caseList) && c.caseList.length) {
							if (!aiMsg.references) {
								aiMsg.references = {};
							}
							aiMsg.references.caseList = c.caseList;
						}
					}
				} catch (err) {
					console.error("解析咨询响应失败", err);
				}
			};

			await new Promise<void>((resolve, reject) => {
				let buffer = "";
				const decoder = createSseDecoder();

				const handleChunk = (data: ArrayBuffer) => {
					// 检查是否已中断或请求ID不匹配（说明是旧请求）
					if (this.isAborted || requestId !== this.currentRequestId) return;

					try {
						const chunkStr = decoder.decode(data);
						if (!chunkStr) return;

						buffer += chunkStr;
						const lines = buffer.split(/\r?\n/);
						buffer = lines.pop() ?? "";

						for (const raw of lines) {
							processSseLine(raw);
						}
					} catch (err) {
						console.error("处理咨询流式数据失败", err);
					}
				};

				const requestTask: any = uni.request({
					url: config.baseUrl + "/law/consult",
					method: "POST",
					data: payload as any,
					header: {
						"Content-Type": "application/json",
						Authorization: user.token || ""
					},
					timeout: 5 * 60 * 1000, // 5 分钟超时
					enableChunked: true,
					responseType: "arraybuffer",
					success: (res: any) => {
						try {
							if (res.data) {
								handleChunk(res.data as ArrayBuffer);
							}
							const remaining = decoder.flush();
							if (remaining) {
								buffer += remaining;
							}
							if (buffer) {
								const lastLines = buffer.split(/\r?\n/);
								buffer = "";
								for (const raw of lastLines) {
									processSseLine(raw);
								}
							}
							resolve();
						} catch (err) {
							reject(err);
						}
					},
					fail: (err: any) => {
						// 检测是否是用户主动中断
						const isAbort = this.isAborted || err?.errMsg?.includes("abort");
						if (!isAbort) {
							console.error("[ConsultStream] wx.request fail:", err);
						}
						reject(err);
					}
				} as any);

				// 保存请求任务引用，支持中断
				this.currentRequestTask = requestTask;

				if (requestTask && typeof requestTask.onChunkReceived === "function") {
					requestTask.onChunkReceived((res: any) => {
						handleChunk(res.data as ArrayBuffer);
					});
				}
			});

			// 清空请求任务引用
			this.currentRequestTask = null;

			// 如果请求ID不匹配，说明已被新请求取代，跳过后续处理
			if (requestId !== this.currentRequestId) {
				return;
			}

			// 如果存在深度思考，记录结束时间
			if (aiMsg.deepThink && aiMsg.deepThinkStartTime && !aiMsg.deepThinkEndTime) {
				aiMsg.deepThinkEndTime = Date.now();
			}

			// 2. AI 回复完成后保存一次（不再自动加载法规/案例详情，改为按需加载）
			await this.saveCurrentSessionSnapshot();
			// 根据 AI 文本中的推荐标记触发推荐律师逻辑
			await this.fetchRecommendLawyers(aiMsg);
		} catch (err: any) {
			console.error("[ConsultSession] 查询失败", err);
			// 只在非中断错误时显示错误消息
			const isAbort = this.isAborted || err?.errMsg?.includes("abort");
			if (!isAbort && requestId === this.currentRequestId) {
				aiMsg.content = "咨询失败，请稍后重试";
				this.streamStatus.value = null;
			}
		} finally {
			// 只有当前请求才能修改 loading 状态
			if (requestId === this.currentRequestId) {
				this.loading.value = false;
			}
		}
	}

	// 获取法规/案例详情
	private async fetchReferencesDetail(aiMsg: ConsultMessage) {
		try {
			if (!aiMsg.references) return;

			// 找到消息在数组中的索引
			const msgIndex = this.messages.value.findIndex((m) => m === aiMsg);
			if (msgIndex === -1) return;

			const updateMessage = (updater: (refs: ConsultMessageReferences) => void) => {
				const msg = this.messages.value[msgIndex];
				if (msg.references) {
					updater(msg.references);
					this.messages.value = [...this.messages.value];
				}
			};

			const refs = aiMsg.references;
			const promises: Promise<void>[] = [];

			// 获取法规详情
			if (refs.lawList && refs.lawList.length > 0) {
				updateMessage((r) => (r.loadingLaw = true));

				const lawDetailList = refs.lawList
					.filter((item) => item.lawId)
					.map((item) => ({
						lawId: item.lawId!,
						lawItemId: item.lawItemId || ""
					}));

				if (lawDetailList.length > 0) {
					promises.push(
						GetLawCardDetail(lawDetailList)
							.then((res: any) => {
								const lawData = res?.data ?? res ?? [];
								updateMessage((r) => {
									r.lawDetails = Array.isArray(lawData) ? lawData : [];
									r.loadingLaw = false;
								});
							})
							.catch((err) => {
								console.error("[ConsultSession] 获取法规详情失败", err);
								updateMessage((r) => {
									r.lawDetails = [];
									r.loadingLaw = false;
								});
							})
					);
				} else {
					updateMessage((r) => (r.loadingLaw = false));
				}
			}

			// 获取案例详情
			if (refs.caseList && refs.caseList.length > 0) {
				updateMessage((r) => (r.loadingCase = true));

				promises.push(
					GetCaseCardDetail(refs.caseList)
						.then((res: any) => {
							// 兼容不同的返回格式
							const caseData = res?.data ?? res ?? [];
							updateMessage((r) => {
								r.caseDetails = Array.isArray(caseData) ? caseData : [];
								r.loadingCase = false;
							});
						})
						.catch((err) => {
							console.error("[ConsultSession] 获取案例详情失败", err);
							updateMessage((r) => {
								r.caseDetails = [];
								r.loadingCase = false;
							});
						})
				);
			}

			// 等待所有请求完成
			if (promises.length > 0) {
				await Promise.all(promises);
				await this.saveCurrentSessionSnapshot();
			}
		} catch (err) {
			console.error("[ConsultSession] 获取引用详情失败", err);
		}
	}

	// 根据当前 AI 消息内容决定是否请求推荐律师，并将结果挂载回消息对象
	private async fetchRecommendLawyers(aiMsg: ConsultMessage) {
		try {
			const { user } = useStore();
			const userId = (user as any)?.info?.value?.id as number | undefined;
			if (!this.sessionId.value || !userId || !aiMsg || !aiMsg.haveRecommendLawyer) {
				return;
			}

			// 开始加载推荐律师
			this.recommendLoading.value = true;

			const res = (await RecommendLawyers({
				session_id: this.sessionId.value,
				// 默认按评分倒序
				sort_by: "rating",
				order: "desc",
				limit: 5
			})) as any;
			if (Array.isArray(res) && res.length) {
				aiMsg.haveRecommendLawyer = true;
				aiMsg.recommendedLawyers = res;
				// 推荐结果挂载后，再保存一份包含推荐律师信息的会话快照
				await this.saveCurrentSessionSnapshot();
			}
		} catch (err) {
			console.error("[ConsultSession] 推荐律师失败", err);
		} finally {
			this.recommendLoading.value = false;
		}
	}

	/**
	 * 从历史记录恢复会话
	 * @param sessionId 会话 ID
	 * @param messages 历史消息列表
	 */
	restoreFromHistory(sessionId: string, messages: ConsultMessage[]) {
		this.sessionId.value = sessionId;
		this.messages.value = messages;
		this.loading.value = false;
		this.recommendLoading.value = false;
		this.streamStatus.value = null;
		this.deepThinkContent.value = "";

		// ========== 清空缓存，不主动加载详情（按需加载） ==========
		this.lawDetailsMap.clear();
		this.caseDetailsMap.clear();
		// 不再调用 loadMissingReferencesDetail()，详情数据在展开时按需加载
	}

	/**
	 * 从历史记录进入时加载引用详情
	 */
	private async loadMissingReferencesDetail() {
		for (const msg of this.messages.value) {
			if (msg.role !== "system" || !msg.references) continue;

			const refs = msg.references;
			const needLoadLaw = refs.lawList?.length && !refs.lawDetails?.length;
			const needLoadCase = refs.caseList?.length && !refs.caseDetails?.length;

			if (needLoadLaw || needLoadCase) {
				await this.fetchReferencesDetail(msg);
			}
		}
	}

	/**
	 * 停止当前流式响应
	 */
	stopStreaming() {
		// 设置中断标志，阻止后续数据处理
		this.isAborted = true;

		if (this.currentRequestTask) {
			try {
				if (typeof this.currentRequestTask.abort === "function") {
					this.currentRequestTask.abort();
				}
			} catch (err) {
				console.error("[ConsultSession] 中断请求失败", err);
			}
			this.currentRequestTask = null;
		}
		this.loading.value = false;
		this.streamStatus.value = null;
	}

	clear() {
		this.stopStreaming();
		this.messages.value = [];
		this.sessionId.value = null;

		// ========== 清空缓存 ==========
		this.lawDetailsMap.clear();
		this.caseDetailsMap.clear();
	}
}

export const consultSessionStore = new ConsultSessionStore();
