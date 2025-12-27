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
import { GetLawCardDetail, type LawDetailResponse } from "@/api/references";
import type { CaseModelType } from "./caseSession";
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

export interface LawMessageReferences {
	searchList?: Array<{
		hostName?: string;
		hostLogo?: string;
		indexId?: number;
		time?: string;
		title?: string;
		body?: string;
		url?: string;
	}>;
	// 律之星返回的法规 ID 列表 (用于查询详情)
	lawList?: Array<{
		lawId?: string;
		lawItemId?: string;
	}>;
	// 律之星返回的原始结果列表 (用于卡片渲染)
	lzxResults?: LzxLawResultItem[];
	// 法宝返回的法规列表 (直接展示)
	fabaoLawList?: FabaoLawReferenceItem[];
	lawDetails?: LawDetailResponse[];
	loadingLaw?: boolean;
}

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
	modelType = ref<LawModelType | CaseModelType | undefined>("fabao"); // 默认通用版
	modelLocked = ref(false); // 对话开始后锁定

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
		this.modelType.value = launch.modelType || "fabao";
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
			isStreaming: false,
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
	 * 律之星查询 (非流式)
	 */
	private async sendLzxQuery(text: string, aiMsg: LawMessage, hooks?: LawStreamHooks) {
		this.streamStatus.value = "正在检索法规...";

		const res = await QueryLzxLaw({ vector: text, rows: 10 });
		// request 函数在 code=200 时直接返回 data 字段，所以用 res?.result
		const result = ((res as any)?.result || []) as LzxLawResultItem[];

		if (result.length > 0) {
			// 简要总结，详细内容由卡片组件展示
			aiMsg.content = `根据您的查询，找到 **${result.length}** 条相关法规：`;
			aiMsg.references = {
				// 保存原始结果用于卡片渲染
				lzxResults: result,
				// 兼容：保留 lawList 用于可能的详情查询
				lawList: result.map((item) => ({
					lawId: item.lawId,
					lawItemId: item.rawnumber
				}))
			};
			hooks?.onTextChunk?.(aiMsg.content);
		} else {
			aiMsg.content = "未找到相关法规，请尝试其他关键词。";
			hooks?.onTextChunk?.(aiMsg.content);
		}
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
								if (!aiMsg.references) {
									aiMsg.references = {};
								}
								aiMsg.references.fabaoLawList = evt.result.map((item) => ({
									title: item.title,
									article: item.article,
									url: item.url
								}));
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
	 * 获取法规详情 (仅律之星模式需要)
	 */
	private async fetchReferencesDetail(aiMsg: LawMessage) {
		try {
			if (!aiMsg.references) return;

			const msgIndex = this.messages.value.findIndex((m) => m === aiMsg);
			if (msgIndex === -1) return;

			const updateMessage = (updater: (refs: LawMessageReferences) => void) => {
				const msg = this.messages.value[msgIndex];
				if (msg.references) {
					updater(msg.references);
					this.messages.value = [...this.messages.value];
				}
			};

			const refs = aiMsg.references;

			if (refs.lawList && refs.lawList.length > 0) {
				updateMessage((r) => (r.loadingLaw = true));

				const lawDetailList = refs.lawList
					.filter((item) => item.lawId)
					.map((item) => ({
						lawId: item.lawId!,
						lawItemId: item.lawItemId || ""
					}));

				if (lawDetailList.length > 0) {
					try {
						const res = await GetLawCardDetail(lawDetailList);
						const lawData = (res as any)?.data ?? res ?? [];
						updateMessage((r) => {
							r.lawDetails = Array.isArray(lawData) ? lawData : [];
							r.loadingLaw = false;
						});
					} catch (err) {
						console.error("[LawSession] 获取法规详情失败", err);
						updateMessage((r) => {
							r.lawDetails = [];
							r.loadingLaw = false;
						});
					}

					await this.saveCurrentSessionSnapshot();
				} else {
					updateMessage((r) => (r.loadingLaw = false));
				}
			}
		} catch (err) {
			console.error("[LawSession] 获取引用详情失败", err);
		}
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

		this.loadMissingReferencesDetail();
	}

	private async loadMissingReferencesDetail() {
		for (const msg of this.messages.value) {
			if (msg.role !== "system" || !msg.references) continue;

			const refs = msg.references;
			const needLoadLaw = refs.lawList?.length && !refs.lawDetails?.length;

			if (needLoadLaw) {
				await this.fetchReferencesDetail(msg);
			}
		}
	}

	clear() {
		this.messages.value = [];
		this.sessionId.value = null;
		this.modelLocked.value = false;
		this.modelType.value = "fabao"; // 重置为默认
	}
}

export const lawSessionStore = new LawSessionStore();
