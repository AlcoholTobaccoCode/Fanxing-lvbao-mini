import { ref } from "vue";
import { config } from "@/config";
import { useStore } from "@/cool";
import { SaveMessages, type SaveMessagesPayload } from "@/api/history-chat";
import { generateUUID } from "@/utils/util";
import { createSseDecoder } from "@/cool/utils/sse-decoder";
import {
	QueryFaruiCase,
	type FaruiCaseResultItem,
	type FabaoLawMessage,
	type FabaoSsePayload
} from "@/api/retrieve";
import type { ChatLaunchPayload } from "./flow";
import type { Tools } from "@/cool/types/chat-input";
import { createModelSessionId } from "@/utils/assetsConfig";

//#region 类型定义

/**
 * 案例检索模型类型
 * - farui: 法睿 (专业版) - 非流式，返回案例列表
 * - fabao: 法宝 (通用版) - 流式 SSE，智能分析
 */
export type CaseModelType = "farui" | "fabao";

/**
 * 法宝流式响应阶段类型
 */
export type FabaoCaseStageType =
	| "info"
	| "mcp_call"
	| "mcp_result"
	| "qwen"
	| "qwen_delta"
	| "final";

/**
 * 法宝阶段状态
 */
export interface FabaoCaseStageItem {
	stage: FabaoCaseStageType;
	status: "pending" | "active" | "completed";
	message?: string;
	searchKeyword?: string; // mcp_call 时的搜索关键词
	resultCount?: number; // mcp_result 时的结果数量
}

export interface CaseMessageReferencesObject {
	searchList?: Array<{
		hostName?: string;
		hostLogo?: string;
		indexId?: number;
		time?: string;
		title?: string;
		body?: string;
		url?: string;
	}>;
	// 法宝流式阶段状态 (用于分步展示)
	fabaoStages?: FabaoCaseStageItem[];
}

/**
 * 案例消息引用
 * - 法睿: 直接是 FaruiCaseResultItem[]
 * - 法宝: CaseMessageReferencesObject 对象
 */
export type CaseMessageReferences = FaruiCaseResultItem[] | CaseMessageReferencesObject;

export interface CaseMessage {
	role: "user" | "system";
	content: string;
	fromVoice?: boolean;
	voiceUrl?: string;
	voiceLength?: number;
	references?: CaseMessageReferences;
}

export interface CaseStreamHooks {
	onTextChunk?: (chunk: string) => void;
}

//#endregion

export class CaseSessionStore {
	messages = ref<CaseMessage[]>([]);
	sessionId = ref<string | null>(null);
	loading = ref(false);
	streamStatus = ref<string | null>(null);

	// 模型选择相关
	modelType = ref<CaseModelType>("fabao"); // 默认通用版
	modelLocked = ref(false); // 对话开始后锁定

	// 法睿分页相关
	faruiKeywords = ref<string[]>([]); // 关键词
	faruiCurrentPage = ref(1); // 当前页
	faruiTotalCount = ref(0); // 总数量
	faruiPageSize = ref(5); // 每页数量
	faruiDisplayCount = ref(5); // 每页数量
	loadingMore = ref(false); // 加载更多状态
	lastQuery = ref(""); // 上次查询内容

	// 当前正在进行的请求任务，用于支持中断
	private currentRequestTask: any = null;
	// 中断标志，用于阻止已在队列中的数据继续处理
	private isAborted = false;
	// 当前请求ID，用于区分不同请求，防止旧请求回调影响新请求
	private currentRequestId = 0;

	/**
	 * 设置模型类型 (仅在未锁定时可用)
	 */
	setModelType(type: CaseModelType) {
		if (!this.modelLocked.value) {
			this.modelType.value = type;
		}
	}

	initFromLaunch(launch: ChatLaunchPayload) {
		this.messages.value = [];
		this.sessionId.value = null;
		this.modelLocked.value = false;
		// 使用启动参数中的模型类型，默认通用版
		this.modelType.value = (launch as any).modelType || "fabao";
	}

	private buildSessionForSave(sessionId: string, msgList?: CaseMessage[]) {
		const list = msgList || this.messages.value;
		const firstUserMsg = list.find((m) => m.role === "user");
		const rawTitle = firstUserMsg?.content || "新对话";
		const title = rawTitle.length <= 30 ? rawTitle : rawTitle.slice(0, 30) + "...";
		const now = Date.now();
		const date = new Date(now);
		const pad = (n: number) => n.toString().padStart(2, "0");
		const dateTimeStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
			date.getDate()
		)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

		const mappedMessages = list.map((m) => ({
			id: generateUUID(),
			content: m.content,
			role: m.role,
			timestamp: dateTimeStr,
			references: m.references,
			voice: m.voiceUrl,
			voiceLength: m.voiceLength
		}));

		return {
			id: sessionId,
			title,
			messages: mappedMessages,
			createdAt: now,
			updatedAt: now,
			modelType: this.modelType.value // 保存模型类型
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
			console.error("[CaseSession] 保存会话失败", err);
		}
	}

	/**
	 * 发送文本问题 - 根据模型类型分发
	 */
	async sendTextQuestion(
		text: string,
		_tools: Tools,
		hooks?: CaseStreamHooks,
		options?: { fromVoice?: boolean; voiceUrl?: string; voiceLength?: number }
	) {
		const content = text.trim();
		if (!content || this.loading.value) return;

		// 首轮发送时生成 sessionId 并锁定模型
		if (!this.sessionId.value) {
			this.sessionId.value = createModelSessionId("case");
		}

		// 锁定模型选择
		if (!this.modelLocked.value) {
			this.modelLocked.value = true;
		}

		// 添加用户消息
		this.messages.value.push({
			role: "user",
			content,
			fromVoice: !!options?.fromVoice,
			voiceUrl: options?.voiceUrl,
			voiceLength: options?.voiceLength
		});

		await this.saveCurrentSessionSnapshot();

		// 添加 AI 回复占位
		this.messages.value.push({ role: "system", content: "" });
		const aiMsg = this.messages.value[this.messages.value.length - 1];

		this.isAborted = false;
		// 生成新的请求ID，使旧请求的回调失效
		const requestId = ++this.currentRequestId;
		this.loading.value = true;

		try {
			// 根据模型类型分发
			if (this.modelType.value === "farui") {
				await this.sendFaruiQuery(content, aiMsg, hooks);
			} else {
				await this.sendFabaoQuery(aiMsg, hooks);
			}

			// 如果请求ID不匹配，说明已被新请求取代，跳过后续处理
			if (requestId !== this.currentRequestId) {
				return;
			}

			this.streamStatus.value = null;
			await this.saveCurrentSessionSnapshot();
		} catch (err) {
			console.error("[CaseSession] 检索失败", err);
			if (requestId === this.currentRequestId) {
				aiMsg.content = "检索失败，请稍后重试";
				this.streamStatus.value = null;
			}
		} finally {
			// 只有当前请求才能修改 loading 状态
			if (requestId === this.currentRequestId) {
				this.loading.value = false;
			}
		}
	}

	/**
	 * 法睿查询 (非流式)
	 */
	private async sendFaruiQuery(text: string, aiMsg: CaseMessage, hooks?: CaseStreamHooks) {
		this.streamStatus.value = "正在检索案例...";
		this.lastQuery.value = text;

		const res = await QueryFaruiCase({
			content: text,
			pageNumber: 1,
			pageSize: this.faruiPageSize.value
		});
		const responseData = (res as any)?.data ?? res;
		const caseResult = responseData?.caseResult || [];

		// 保存分页信息
		this.faruiCurrentPage.value = responseData?.currentPage || 1;
		this.faruiTotalCount.value = responseData?.totalCount || caseResult.length;
		this.faruiPageSize.value = responseData?.pageSize || this.faruiDisplayCount.value;

		// 保存关键词
		this.faruiKeywords.value = responseData?.queryKeywords || [];

		if (caseResult.length > 0) {
			aiMsg.content = `根据您的检索，找到以下相关案例：`;
			// 法睿：references 直接存储结果数组
			aiMsg.references = caseResult;
			hooks?.onTextChunk?.(aiMsg.content);
		} else {
			aiMsg.content = "未找到相关案例，请尝试其他关键词。";
			hooks?.onTextChunk?.(aiMsg.content);
		}
	}

	/**
	 * 加载更多法睿案例
	 */
	async loadMoreFaruiResults() {
		if (this.loadingMore.value) return;
		if (!this.lastQuery.value) return;

		// 检查是否还有更多
		const currentTotal = this.faruiCurrentPage.value * this.faruiPageSize.value;
		if (currentTotal >= this.faruiTotalCount.value) return;

		this.loadingMore.value = true;

		try {
			const nextPage = this.faruiCurrentPage.value + 1;
			const res = await QueryFaruiCase({
				content: this.lastQuery.value,
				pageNumber: nextPage,
				pageSize: this.faruiPageSize.value
			});
			const responseData = (res as any)?.data ?? res;
			const newResults = responseData?.caseResult || [];

			if (newResults.length > 0) {
				// 更新页码
				this.faruiCurrentPage.value = nextPage;

				// 找到最后一条 AI 消息并追加结果
				const lastAiMsg = [...this.messages.value]
					.reverse()
					.find((m) => m.role === "system");
				if (lastAiMsg && Array.isArray(lastAiMsg.references)) {
					// 直接追加到数组
					lastAiMsg.references = [...lastAiMsg.references, ...newResults];
					// 触发响应式更新
					this.messages.value = [...this.messages.value];
				}

				await this.saveCurrentSessionSnapshot();
			}
		} catch (err) {
			console.error("[CaseSession] 加载更多失败", err);
		} finally {
			this.loadingMore.value = false;
		}
	}

	/**
	 * 法宝查询 (SSE 流式)
	 */
	private async sendFabaoQuery(aiMsg: CaseMessage, hooks?: CaseStreamHooks) {
		// 捕获当前请求ID，用于检查是否被新请求取代
		const requestId = this.currentRequestId;
		this.streamStatus.value = "正在分析问题...";

		// 初始化阶段状态
		const refsObj: CaseMessageReferencesObject = { fabaoStages: [] };
		aiMsg.references = refsObj;

		// 辅助函数：更新阶段状态（保留已有的 message 等字段）
		const updateStage = (
			stage: FabaoCaseStageType,
			status: "pending" | "active" | "completed",
			extra?: Partial<FabaoCaseStageItem>
		) => {
			const refs = aiMsg.references as CaseMessageReferencesObject;
			if (!refs.fabaoStages) refs.fabaoStages = [];

			const existingIndex = refs.fabaoStages.findIndex((s) => s.stage === stage);
			const existingStage = existingIndex >= 0 ? refs.fabaoStages[existingIndex] : null;

			// 合并现有属性，保留 message、searchKeyword、resultCount
			const stageItem: FabaoCaseStageItem = {
				stage,
				status,
				// 优先使用现有值，再被 extra 覆盖
				...(existingStage?.message ? { message: existingStage.message } : {}),
				...(existingStage?.searchKeyword
					? { searchKeyword: existingStage.searchKeyword }
					: {}),
				...(existingStage?.resultCount !== undefined
					? { resultCount: existingStage.resultCount }
					: {}),
				...extra
			};

			if (existingIndex >= 0) {
				refs.fabaoStages[existingIndex] = stageItem;
			} else {
				refs.fabaoStages.push(stageItem);
			}
			// 触发响应式更新
			this.messages.value = [...this.messages.value];
		};

		// 构建 messages 数组 (支持多轮对话上下文)
		const apiMessages: FabaoLawMessage[] = this.messages.value
			.filter((m) => m.content) // 过滤空消息
			.map((m) => ({
				role: m.role === "user" ? "user" : ("system" as const),
				content: m.content
			}));

		const { user } = useStore();

		await new Promise<void>((resolve, reject) => {
			let buffer = "";
			const decoder = createSseDecoder();

			const processSseLine = (rawLine: string) => {
				// 检查是否已中断或请求ID不匹配（说明是旧请求）
				if (this.isAborted || requestId !== this.currentRequestId) return;

				const line = rawLine.trim();
				if (!line) return;

				// 解析 "data: data: {...}" 格式
				let jsonStr: string | null = null;

				if (line.startsWith("data:")) {
					let payload = line.slice(5).trim();
					// 处理双重 data: 前缀
					if (payload.startsWith("data:")) {
						payload = payload.slice(5).trim();
					}
					if (!payload || payload === "[DONE]") return;
					jsonStr = payload;
				} else if (line.startsWith("{")) {
					jsonStr = line;
				} else {
					return;
				}

				try {
					const evt = JSON.parse(jsonStr) as FabaoSsePayload;

					switch (evt.stage) {
						case "info":
							this.streamStatus.value = evt.message || "正在处理...";
							updateStage("info", "active", { message: evt.message });
							break;

						case "mcp_call":
							this.streamStatus.value = `正在检索: ${evt.args?.text || "案例"}`;
							// 完成 info 阶段
							updateStage("info", "completed");
							// 开始 mcp_call 阶段
							updateStage("mcp_call", "active", {
								message: `检索: ${evt.args?.text || "案例"}`,
								searchKeyword: evt.args?.text
							});
							break;

						case "mcp_result":
							// 完成 mcp_call 阶段
							updateStage("mcp_call", "completed");
							if (evt.cases && Array.isArray(evt.cases)) {
								updateStage("mcp_result", "completed", {
									message: `找到 ${evt.cases.length} 条相关案例`,
									resultCount: evt.cases.length
								});
							} else {
								updateStage("mcp_result", "completed", {
									message: "检索完成"
								});
							}
							break;

						case "qwen":
							this.streamStatus.value = evt.message || "正在生成回答...";
							updateStage("qwen", "active", { message: evt.message });
							break;

						case "qwen_delta": {
							// 首次收到 delta 时，标记 qwen 完成，开始 qwen_delta
							const refs = aiMsg.references as CaseMessageReferencesObject;
							const qwenStage = refs.fabaoStages?.find((s) => s.stage === "qwen");
							if (qwenStage?.status === "active") {
								updateStage("qwen", "completed");
								updateStage("qwen_delta", "active", { message: "正在输出回答..." });
							}

							if (evt.delta) {
								aiMsg.content += evt.delta;
								hooks?.onTextChunk?.(evt.delta);
							}
							// 检查是否结束
							if (evt.event === "end") {
								updateStage("qwen_delta", "completed");
								this.streamStatus.value = null;
							}
							break;
						}

						case "final":
							if (evt.content) {
								aiMsg.content = evt.content;
							}
							updateStage("final", "completed", { message: "最终结果已生成" });
							this.streamStatus.value = null;
							break;
					}
				} catch (err) {
					console.error("[CaseSession] 解析法宝响应失败", err, jsonStr);
				}
			};

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
					console.error("[CaseSession] 处理流式数据失败", err);
				}
			};

			const requestTask: any = uni.request({
				url: config.baseUrl + "/law/queryCase1",
				method: "POST",
				data: { messages: apiMessages } as any,
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
					console.error("[CaseSession] 法宝请求失败:", err);
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
				console.error("[CaseSession] 中断请求失败", err);
			}
			this.currentRequestTask = null;
		}
		this.loading.value = false;
		this.streamStatus.value = null;
	}

	/**
	 * 从历史记录恢复会话
	 */
	restoreFromHistory(sessionId: string, messages: CaseMessage[], modelType?: CaseModelType) {
		this.sessionId.value = sessionId;
		this.messages.value = messages;
		this.loading.value = false;
		this.streamStatus.value = null;
		this.modelType.value = modelType || "fabao";
		this.modelLocked.value = true; // 恢复时锁定模型
	}

	clear() {
		this.stopStreaming();
		this.messages.value = [];
		this.sessionId.value = null;
		this.modelLocked.value = false;
		this.modelType.value = "fabao"; // 重置为默认
		// 重置分页相关状态
		this.faruiKeywords.value = [];
		this.faruiCurrentPage.value = 1;
		this.faruiTotalCount.value = 0;
		this.faruiPageSize.value = 10;
		this.loadingMore.value = false;
		this.lastQuery.value = "";
	}
}

export const caseSessionStore = new CaseSessionStore();
