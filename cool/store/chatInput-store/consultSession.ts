import { ref } from "vue";
import { config } from "@/config";
import { useStore } from "@/cool";
import { RecommendLawyers, type RecommendLawyerItem } from "@/api/consult";
import { createModelSessionId } from "@/utils/assetsConfig";
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

// TODO - MOCK
import { LawyerList } from "./mockData";

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

			return {
				id: generateUUID(),
				content: m.content,
				role: m.role,
				timestamp: dateTimeStr,
				deepThink: m.deepThink,
				thinkingTime,
				references: m.references,
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
					const evt = JSON.parse(jsonStr) as {
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
						console.error("[ConsultStream] wx.request fail:", err);
						reject(err);
					}
				} as any);

				if (requestTask && typeof requestTask.onChunkReceived === "function") {
					requestTask.onChunkReceived((res: any) => {
						handleChunk(res.data as ArrayBuffer);
					});
				}
			});

			// 如果存在深度思考，记录结束时间
			if (aiMsg.deepThink && aiMsg.deepThinkStartTime && !aiMsg.deepThinkEndTime) {
				aiMsg.deepThinkEndTime = Date.now();
			}

			// 2. AI 回复完成后保存一次
			await this.saveCurrentSessionSnapshot();
			// 获取法规/案例详情（并行请求）
			await this.fetchReferencesDetail(aiMsg);
			// 再根据 AI 文本中的推荐标记触发推荐律师逻辑
			await this.fetchRecommendLawyers(aiMsg);
		} finally {
			this.loading.value = false;
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
			const list = res ? [...(res as RecommendLawyerItem[])] : [...LawyerList];

			if (Array.isArray(list) && list.length) {
				aiMsg.haveRecommendLawyer = true;
				aiMsg.recommendedLawyers = list;
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

		// 加载引用详情
		this.loadMissingReferencesDetail();
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

	clear() {
		this.messages.value = [];
		this.sessionId.value = null;
	}
}

export const consultSessionStore = new ConsultSessionStore();
