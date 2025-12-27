import { ref } from "vue";
import { config } from "@/config";
import { useStore } from "@/cool";
import { createModelSessionId } from "@/utils/assetsConfig";
import { SaveMessages, type SaveMessagesPayload } from "@/api/history-chat";
import { generateUUID } from "@/utils/util";
import {
	QueryLzxLaw,
	type LzxLawResultItem,
	type FabaoLawMessage,
	type FabaoSsePayload
} from "@/api/retrieve";
import type { ChatLaunchPayload } from "./flow";
import type { Tools } from "@/cool/types/chat-input";
/**
 * 法规检索模型类型
 * - lzx: 律之星 (专业版) - 非流式，专业死板
 * - fabao: 法宝 (通用版) - 流式 SSE，灵活有思考
 */
export type LawModelType = "lzx" | "fabao";

/**
 * 法宝引用项 (直接从 mcp_result 获取)
 */
export interface FabaoLawReferenceItem {
	title: string;
	article: string;
	url: string;
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
	// 法宝返回的法规列表 (直接展示)
	fabaoLawList?: FabaoLawReferenceItem[];
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

export class LawSessionStore {
	messages = ref<LawMessage[]>([]);
	sessionId = ref<string | null>(null);
	loading = ref(false);
	streamStatus = ref<string | null>(null);

	// 模型选择相关
	modelType = ref<LawModelType>("fabao"); // 默认通用版
	modelLocked = ref(false); // 对话开始后锁定

	// 律之星前端分页相关 (一次查询100条，前端分页展示)
	lzxPageSize = ref(10); // 每页展示数量
	lzxDisplayCount = ref(10); // 当前展示数量
	lzxLoadingMore = ref(false); // 加载更多状态

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
			references: m.references
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

		this.loading.value = true;

		try {
			// 根据模型类型分发
			if (this.modelType.value === "lzx") {
				await this.sendLzxQuery(content, aiMsg, hooks);
			} else {
				await this.sendFabaoQuery(aiMsg, hooks);
			}

			this.streamStatus.value = null;
			await this.saveCurrentSessionSnapshot();
		} catch (err) {
			console.error("[LawSession] 查询失败", err);
			aiMsg.content = "查询失败，请稍后重试";
			this.streamStatus.value = null;
		} finally {
			this.loading.value = false;
		}
	}

	/**
	 * 律之星查询 (非流式，一次查100条，前端分页)
	 */
	private async sendLzxQuery(text: string, aiMsg: LawMessage, hooks?: LawStreamHooks) {
		this.streamStatus.value = "正在检索法规...";

		// 一次性查询100条（律之星最大支持数量）
		const res = await QueryLzxLaw({ vector: text, rows: 100 });
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
		this.streamStatus.value = "正在分析问题...";

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

			const processSseLine = (rawLine: string) => {
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
							break;

						case "mcp_call":
							this.streamStatus.value = `正在检索: ${evt.args?.text || "法规"}`;
							break;

						case "mcp_result":
							// 保存法宝引用数据 (直接使用，无需二次查询)
							if (evt.result && Array.isArray(evt.result)) {
								const refsObj: LawMessageReferencesObject = !aiMsg.references
									? {}
									: Array.isArray(aiMsg.references)
										? {}
										: aiMsg.references;
								refsObj.fabaoLawList = evt.result.map((item) => ({
									title: item.title,
									article: item.article,
									url: item.url
								}));
								aiMsg.references = refsObj;
							}
							break;

						case "qwen":
							this.streamStatus.value = evt.message || "正在生成回答...";
							break;

						case "qwen_delta":
							if (evt.delta) {
								aiMsg.content += evt.delta;
								hooks?.onTextChunk?.(evt.delta);
							}
							// 检查是否结束
							if (evt.event === "end") {
								this.streamStatus.value = null;
							}
							break;

						case "final":
							if (evt.content) {
								aiMsg.content = evt.content;
							}
							this.streamStatus.value = null;
							break;
					}
				} catch (err) {
					console.error("[LawSession] 解析法宝响应失败", err, jsonStr);
				}
			};

			const handleChunk = (data: ArrayBuffer) => {
				try {
					let chunkStr = "";
					if (typeof TextDecoder !== "undefined") {
						chunkStr = new TextDecoder("utf-8").decode(data);
					} else {
						const uint8 = new Uint8Array(data);
						let str = "";
						for (let i = 0; i < uint8.length; i++) {
							str += String.fromCharCode(uint8[i]);
						}
						try {
							chunkStr = decodeURIComponent(escape(str));
						} catch {
							chunkStr = str;
						}
					}

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
							// 处理剩余 buffer
							if (buffer) {
								const lastLines = buffer.split(/\r?\n/);
								buffer = "";
								for (const raw of lastLines) {
									processSseLine(raw);
								}
							}
						}
						resolve();
					} catch (err) {
						reject(err);
					}
				},
				fail: (err: any) => {
					console.error("[LawSession] 法宝请求失败:", err);
					reject(err);
				}
			} as any);

			if (requestTask && typeof requestTask.onChunkReceived === "function") {
				requestTask.onChunkReceived((res: any) => {
					handleChunk(res.data as ArrayBuffer);
				});
			}
		});
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
