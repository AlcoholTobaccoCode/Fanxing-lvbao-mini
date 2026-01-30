import { ref } from "vue";
import { config } from "@/config";
import { useStore } from "@/cool";
import { SaveMessages, type SaveMessagesPayload } from "@/api/history-chat";
import { generateUUID } from "@/utils/util";
import { createSseDecoder } from "@/cool/utils/sse-decoder";
import {
	QueryLzxLaw,
	type LzxLawResultItem,
	type FabaoLawMessage,
	type FabaoSsePayload
} from "@/api/retrieve";
import type { ChatLaunchPayload } from "./flow";
import type { Tools } from "@/cool/types/chat-input";
import { createModelSessionId } from "@/utils/assetsConfig";
import { lawFilterStore } from "./lawFilterStore";

//#region 类型定义

/**
 * 法规检索模型类型
 * - lzx: 律之星 (专业版) - 非流式，专业死板
 * - fabao: 法宝 (通用版) - 流式 SSE，灵活有思考
 */
export type LawModelType = "lzx" | "fabao";

/**
 * 法宝流式响应阶段类型
 */
export type FabaoStageType = "info" | "mcp_call" | "mcp_result" | "qwen" | "qwen_delta" | "final";

/**
 * 法宝阶段状态
 */
export interface FabaoStageItem {
	stage: FabaoStageType;
	status: "pending" | "active" | "completed";
	message?: string;
	searchKeyword?: string; // mcp_call 时的搜索关键词
	resultCount?: number; // mcp_result 时的结果数量
}

export interface LawMessageReferencesObject {
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
	fabaoStages?: FabaoStageItem[];
}

/**
 * 法规消息引用
 * - 律之星: 直接是 LzxLawResultItem[]
 * - 法宝: LawMessageReferencesObject 对象
 */
export type LawMessageReferences = LzxLawResultItem[] | LawMessageReferencesObject;

export interface LawMessage {
	role: "user" | "system";
	content: string;
	fromVoice?: boolean;
	voiceUrl?: string;
	voiceLength?: number;
	references?: LawMessageReferences;
}

export interface LawStreamHooks {
	onTextChunk?: (chunk: string) => void;
}

//#endregion

export class LawSessionStore {
	messages = ref<LawMessage[]>([]);
	sessionId = ref<string | null>(null);
	loading = ref(false);
	streamStatus = ref<string | null>(null);

	// 模型选择相关
	modelType = ref<LawModelType>("fabao"); // 默认通用版
	modelLocked = ref(false); // 对话开始后锁定

	// 律之星前端分页相关 (一次查询100条，前端分页展示)
	lzxPageSize = ref(5); // 每页展示数量
	lzxDisplayCount = ref(5); // 当前展示数量
	lzxLoadingMore = ref(false); // 加载更多状态

	// 当前正在进行的请求任务，用于支持中断
	private currentRequestTask: any = null;
	// 中断标志，用于阻止已在队列中的数据继续处理
	private isAborted = false;
	// 当前请求ID，用于区分不同请求，防止旧请求回调影响新请求
	private currentRequestId = 0;

	/**
	 * 设置模型类型 (仅在未锁定时可用)
	 */
	setModelType(type: LawModelType) {
		if (!this.modelLocked.value) {
			this.modelType.value = type;
		}
	}

	initFromLaunch(launch: ChatLaunchPayload) {
		this.messages.value = [];
		this.sessionId.value = null;
		this.modelLocked.value = false;
		// 使用启动参数中的模型类型，默认通用版
		this.modelType.value = (launch.modelType as LawModelType) || "fabao";
	}

	private buildSessionForSave(sessionId: string, msgList?: LawMessage[]) {
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
			console.error("[LawSession] 保存会话失败", err);
		}
	}

	/**
	 * 发送文本问题 - 根据模型类型分发
	 */
	async sendTextQuestion(
		text: string,
		_tools: Tools,
		hooks?: LawStreamHooks,
		options?: { fromVoice?: boolean; voiceUrl?: string; voiceLength?: number }
	) {
		const content = text.trim();
		if (!content || this.loading.value) return;

		// 首轮发送时生成 sessionId 并锁定模型
		if (!this.sessionId.value) {
			this.sessionId.value = createModelSessionId("law");
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
			if (this.modelType.value === "lzx") {
				await this.sendLzxQuery(content, aiMsg, hooks);
			} else {
				await this.sendFabaoQuery(aiMsg, hooks);
			}

			// 如果请求ID不匹配，说明已被新请求取代，跳过后续处理
			if (requestId !== this.currentRequestId) {
				return;
			}

			this.streamStatus.value = null;
			await this.saveCurrentSessionSnapshot();
		} catch (err: any) {
			console.error("[LawSession] 查询失败", err);
			// 只在非中断错误时显示错误消息
			const isAbort = this.isAborted || err?.errMsg?.includes('abort');
			if (!isAbort && requestId === this.currentRequestId) {
				aiMsg.content = "查询失败，请稍后重试";
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
	 * 律之星查询 (非流式，一次查100条，前端分页)
	 */
	private async sendLzxQuery(text: string, aiMsg: LawMessage, hooks?: LawStreamHooks) {
		this.streamStatus.value = "正在检索法规...";

		// 读取筛选条件
		const filters = lawFilterStore.filters.value;
		const requestParams: any = {
			vector: text,
			rows: 100
		};

		// 添加筛选参数
		if (filters.area_facet.length > 0) {
			requestParams.area_facet = filters.area_facet.join(" ");
		}
		if (filters.xls.length > 0) {
			requestParams.xls = filters.xls.join(" ");
		}
		if (filters.lawstatexls_facet) {
			requestParams.lawstatexls_facet = filters.lawstatexls_facet;
		}

		// 一次性查询100条（律之星最大支持数量）
		const res = await QueryLzxLaw(requestParams);
		// request 函数在 code=200 时直接返回 data 字段，所以用 res?.result
		const result = ((res as any)?.result || []) as LzxLawResultItem[];

		// 重置前端分页状态
		this.lzxDisplayCount.value = this.lzxPageSize.value;

		if (result.length > 0) {
			// 简要总结，详细内容由卡片组件展示
			aiMsg.content = `根据您的查询，找到以下相关法规：`;
			// 律之星：references 直接存储结果数组
			aiMsg.references = result;
			hooks?.onTextChunk?.(aiMsg.content);
		} else {
			aiMsg.content = "未找到相关法规，请尝试其他关键词。";
			hooks?.onTextChunk?.(aiMsg.content);
		}
	}

	/**
	 * 加载更多律之星结果 (前端分页)
	 * @returns 是否还有更多数据
	 */
	async loadMoreLzxResults(): Promise<boolean> {
		if (this.lzxLoadingMore.value) return false;

		// 获取当前律之星结果总数
		const lastAiMsg = [...this.messages.value].reverse().find((m) => m.role === "system");
		const totalCount = Array.isArray(lastAiMsg?.references) ? lastAiMsg.references.length : 0;

		// 检查是否已经展示全部
		if (this.lzxDisplayCount.value >= totalCount) {
			return false;
		}

		this.lzxLoadingMore.value = true;

		// 模拟加载效果 (多端体验一致)
		await new Promise((resolve) => setTimeout(resolve, 600));

		// 增加展示数量，但不超过总数
		const nextCount = this.lzxDisplayCount.value + this.lzxPageSize.value;
		this.lzxDisplayCount.value = Math.min(nextCount, totalCount);

		this.lzxLoadingMore.value = false;

		// 返回是否还有更多
		return this.lzxDisplayCount.value < totalCount;
	}

	/**
	 * 法宝查询 (SSE 流式)
	 */
	private async sendFabaoQuery(aiMsg: LawMessage, hooks?: LawStreamHooks) {
		// 捕获当前请求ID，用于检查是否被新请求取代
		const requestId = this.currentRequestId;
		this.streamStatus.value = "正在分析问题...";

		// 初始化阶段状态
		const refsObj: LawMessageReferencesObject = { fabaoStages: [] };
		aiMsg.references = refsObj;

		// 辅助函数：更新阶段状态（保留已有的 message 等字段）
		const updateStage = (
			stage: FabaoStageType,
			status: "pending" | "active" | "completed",
			extra?: Partial<FabaoStageItem>
		) => {
			const refs = aiMsg.references as LawMessageReferencesObject;
			if (!refs.fabaoStages) refs.fabaoStages = [];

			const existingIndex = refs.fabaoStages.findIndex((s) => s.stage === stage);
			const existingStage = existingIndex >= 0 ? refs.fabaoStages[existingIndex] : null;

			// 合并现有属性，保留 message、searchKeyword、resultCount
			const stageItem: FabaoStageItem = {
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
							this.streamStatus.value = `正在检索: ${evt.args?.text || "法规"}`;
							// 完成 info 阶段
							updateStage("info", "completed");
							// 开始 mcp_call 阶段
							updateStage("mcp_call", "active", {
								message: `检索: ${evt.args?.text || "法规"}`,
								searchKeyword: evt.args?.text
							});
							break;

						case "mcp_result":
							// 完成 mcp_call 阶段
							updateStage("mcp_call", "completed");
							if (evt.result && Array.isArray(evt.result)) {
								updateStage("mcp_result", "completed", {
									message: `找到 ${evt.result.length} 条相关法规`,
									resultCount: evt.result.length
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

						case "qwen_delta":
							// 首次收到 delta 时，标记 qwen 完成，开始 qwen_delta
							const refs = aiMsg.references as LawMessageReferencesObject;
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

						case "final":
							if (evt.content) {
								aiMsg.content = evt.content;
							}
							updateStage("final", "completed", { message: "最终结果已生成" });
							this.streamStatus.value = null;
							break;
					}
				} catch (err) {
					console.error("[LawSession] 解析法宝响应失败", err, jsonStr);
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
					console.error("[LawSession] 处理流式数据失败", err);
				}
			};

			const requestTask: any = uni.request({
				url: config.baseUrl + "/law/queryLaw1",
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
					// 检测是否是用户主动中断
					const isAbort = this.isAborted || err?.errMsg?.includes('abort');
					if (!isAbort) {
						console.error("[LawSession] 法宝请求失败:", err);
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
				console.error("[LawSession] 中断请求失败", err);
			}
			this.currentRequestTask = null;
		}
		this.loading.value = false;
		this.streamStatus.value = null;
	}

	/**
	 * 从历史记录恢复会话
	 */
	restoreFromHistory(sessionId: string, messages: LawMessage[], modelType?: LawModelType) {
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
		// 重置律之星分页状态
		this.lzxDisplayCount.value = this.lzxPageSize.value;
		this.lzxLoadingMore.value = false;
	}
}

export const lawSessionStore = new LawSessionStore();
