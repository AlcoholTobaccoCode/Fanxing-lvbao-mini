import { ref } from "vue";
import { config } from "@/config";
import { useStore } from "@/cool";
import { createModelSessionId } from "@/utils/assetsConfig";
import { SaveMessages, type SaveMessagesPayload } from "@/api/history-chat";
import { generateUUID } from "@/utils/util";
import {
	QueryFaruiCase,
	type FaruiCaseResultItem,
	type FabaoLawMessage,
	type FabaoSsePayload
} from "@/api/retrieve";
import type { ChatLaunchPayload } from "./flow";
import type { Tools } from "@/cool/types/chat-input";

/**
 * 案例检索模型类型
 * - farui: 法睿 (专业版) - 非流式，返回案例列表
 * - fabao: 法宝 (通用版) - 流式 SSE，智能分析
 */
export type CaseModelType = "farui" | "fabao";

/**
 * 法宝案例引用项
 */
export interface FabaoCaseReferenceItem {
	title: string;
	content: string;
	url: string;
	doc_type?: string;
	case_type?: string;
	court_name?: string;
	decision_date?: string;
	cause_of_action?: string;
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
	// 法宝返回的案例列表 (直接展示)
	fabaoCaseList?: FabaoCaseReferenceItem[];
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
	faruiPageSize = ref(10); // 每页数量
	loadingMore = ref(false); // 加载更多状态
	lastQuery = ref(""); // 上次查询内容

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

		this.loading.value = true;

		try {
			// 根据模型类型分发
			if (this.modelType.value === "farui") {
				await this.sendFaruiQuery(content, aiMsg, hooks);
			} else {
				await this.sendFabaoQuery(aiMsg, hooks);
			}

			this.streamStatus.value = null;
			await this.saveCurrentSessionSnapshot();
		} catch (err) {
			console.error("[CaseSession] 检索失败", err);
			aiMsg.content = "检索失败，请稍后重试";
			this.streamStatus.value = null;
		} finally {
			this.loading.value = false;
		}
	}

	/**
	 * 法睿查询 (非流式)
	 */
	private async sendFaruiQuery(text: string, aiMsg: CaseMessage, hooks?: CaseStreamHooks) {
		this.streamStatus.value = "正在检索案例...";
		this.lastQuery.value = text;

		const res = await QueryFaruiCase({ content: text, pageNumber: 1, pageSize: 10 });
		const responseData = (res as any)?.data ?? res;
		const caseResult = responseData?.caseResult || [];

		// 保存分页信息
		this.faruiCurrentPage.value = responseData?.currentPage || 1;
		this.faruiTotalCount.value = responseData?.totalCount || caseResult.length;
		this.faruiPageSize.value = responseData?.pageSize || 10;

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
							this.streamStatus.value = `正在检索: ${evt.args?.text || "案例"}`;
							break;

						case "mcp_result":
							// 保存法宝案例引用数据
							if (evt.cases && Array.isArray(evt.cases)) {
								const refsObj: CaseMessageReferencesObject = !aiMsg.references
									? {}
									: Array.isArray(aiMsg.references)
										? {}
										: aiMsg.references;
								refsObj.fabaoCaseList = evt.cases.map((item) => ({
									title: item.title,
									content: item.content,
									url: item.url,
									doc_type: item.doc_type,
									case_type: item.case_type,
									court_name: item.court_name,
									decision_date: item.decision_date,
									cause_of_action: item.cause_of_action
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
					console.error("[CaseSession] 解析法宝响应失败", err, jsonStr);
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
					console.error("[CaseSession] 法宝请求失败:", err);
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
	restoreFromHistory(sessionId: string, messages: CaseMessage[], modelType?: CaseModelType) {
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
