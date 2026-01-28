import { ref } from "vue";
import { config } from "@/config";
import { useStore } from "@/cool";
import { SaveMessages, type SaveMessagesPayload } from "@/api/history-chat";
import { generateUUID, generateRandomString } from "@/utils/util";
import { createSseDecoder } from "@/cool/utils/sse-decoder";
import type { ChatLaunchPayload } from "./flow";
import type { Tools } from "@/cool/types/chat-input";

/**
 * 文书生成类型
 * - 0: 起诉状
 * - 1: 答辩状
 * - 2: 合同生成
 */
export type DocGenType = 0 | 1 | 2;

/**
 * 文书类型 Key
 */
export type DocGenKey = "complaint" | "defense" | "contractGen";

/**
 * 文书类型配置映射
 */
export const DOC_GEN_CONFIG: Record<
	DocGenKey,
	{
		type: DocGenType;
		title: string;
		sessionPrefix: string;
	}
> = {
	complaint: {
		type: 0,
		title: "起诉状",
		sessionPrefix: "ai_complaint_"
	},
	defense: {
		type: 1,
		title: "答辩状",
		sessionPrefix: "ai_defense_"
	},
	contractGen: {
		type: 2,
		title: "合同生成",
		sessionPrefix: "ai_contract_generate_"
	}
};

/**
 * 文书生成阶段类型
 */
export type DocGenStageType = "analyzing" | "generating" | "completed";

/**
 * 文书生成阶段状态
 */
export interface DocGenStageItem {
	stage: DocGenStageType;
	status: "pending" | "active" | "completed";
	message?: string;
}

/**
 * 响应类型
 * - QUESTION: 继续追问细节
 * - DOC: 明确生成文书
 */
export type DocResponseType = "QUESTION" | "DOC";

/**
 * 文书生成消息
 */
export interface DocGenMessage {
	role: "user" | "system";
	content: string;
	fromVoice?: boolean;
	voiceUrl?: string;
	voiceLength?: number;
	stages?: DocGenStageItem[];
	/** 响应类型：QUESTION=追问细节，DOC=生成文书 */
	responseType?: DocResponseType;
	/** 是否检测到完整文书（根据 responseType === 'DOC' 判断） */
	hasDocument?: boolean;
}

export interface DocGenStreamHooks {
	onTextChunk?: (chunk: string) => void;
}

export class DocGenSessionStore {
	messages = ref<DocGenMessage[]>([]);
	sessionId = ref<string | null>(null);
	/** 后端返回的历史会话ID（用于多轮对话） */
	historySessionId = ref<string | null>(null);
	loading = ref(false);
	streamStatus = ref<string | null>(null);

	/** 当前文书类型 */
	docType = ref<DocGenKey>("complaint");

	// 当前正在进行的请求任务，用于支持中断
	private currentRequestTask: any = null;
	// 中断标志，用于阻止已在队列中的数据继续处理
	private isAborted = false;
	// 当前请求ID，用于区分不同请求，防止旧请求回调影响新请求
	private currentRequestId = 0;

	/**
	 * 设置文书类型
	 */
	setDocType(type: DocGenKey) {
		this.docType.value = type;
	}

	/**
	 * 获取当前文书配置
	 */
	getDocConfig() {
		return DOC_GEN_CONFIG[this.docType.value];
	}

	initFromLaunch(launch: ChatLaunchPayload) {
		this.messages.value = [];
		this.sessionId.value = null;
		this.historySessionId.value = null;

		// 根据 moduleKey 设置文书类型
		if (
			launch.moduleKey === "complaint" ||
			launch.moduleKey === "defense" ||
			launch.moduleKey === "contractGen"
		) {
			this.docType.value = launch.moduleKey;
		}
	}

	private buildSessionForSave(sessionId: string, msgList?: DocGenMessage[]) {
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
			voice: m.voiceUrl,
			voiceLength: m.voiceLength,
			responseType: m.responseType,
			response_type: m.responseType,
			hasDocument: m.hasDocument
		}));

		return {
			id: sessionId,
			title,
			messages: mappedMessages,
			createdAt: now,
			updatedAt: now,
			historySessionId: this.historySessionId.value
		} as Record<string, any>;
	}

	/**
	 * 保存当前会话快照到后端
	 */
	async saveCurrentSessionSnapshot() {
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
			console.error("[DocGenSession] 保存会话失败", err);
		}
	}

	/**
	 * 发送文本问题
	 */
	async sendTextQuestion(
		text: string,
		_tools: Tools,
		hooks?: DocGenStreamHooks,
		options?: { fromVoice?: boolean; voiceUrl?: string; voiceLength?: number }
	) {
		const content = text.trim();
		if (!content || this.loading.value) return;

		// 首轮发送时生成 sessionId
		if (!this.sessionId.value) {
			const docConfig = this.getDocConfig();
			this.sessionId.value = `${docConfig.sessionPrefix}${generateRandomString(8)}`;
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
		this.messages.value.push({
			role: "system",
			content: "",
			stages: [{ stage: "analyzing", status: "active", message: "正在分析您的需求..." }]
		});
		const aiMsg = this.messages.value[this.messages.value.length - 1];

		this.isAborted = false;
		// 生成新的请求ID，使旧请求的回调失效
		const requestId = ++this.currentRequestId;
		this.loading.value = true;
		this.streamStatus.value = "正在分析需求...";

		try {
			await this.sendDocGenQuery(content, aiMsg, hooks);

			// 如果请求ID不匹配，说明已被新请求取代，跳过后续处理
			if (requestId !== this.currentRequestId) {
				return;
			}

			this.streamStatus.value = null;
			await this.saveCurrentSessionSnapshot();
		} catch (err: any) {
			console.error("[DocGenSession] 生成失败", err);
			// 只在非中断错误时显示错误消息
			const isAbort = this.isAborted || err?.errMsg?.includes("abort");
			if (!isAbort && requestId === this.currentRequestId) {
				aiMsg.content = "生成失败，请稍后重试";
				aiMsg.stages = [{ stage: "completed", status: "completed", message: "生成失败" }];
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
	 * 更新阶段状态
	 */
	private updateStage(
		aiMsg: DocGenMessage,
		stage: DocGenStageType,
		status: "pending" | "active" | "completed",
		message?: string
	) {
		if (!aiMsg.stages) aiMsg.stages = [];

		const existingIndex = aiMsg.stages.findIndex((s) => s.stage === stage);
		const stageItem: DocGenStageItem = { stage, status, message };

		if (existingIndex >= 0) {
			aiMsg.stages[existingIndex] = stageItem;
		} else {
			aiMsg.stages.push(stageItem);
		}

		// 触发响应式更新
		this.messages.value = [...this.messages.value];
	}

	/**
	 * 发送文书生成请求 (SSE 流式)
	 */
	private async sendDocGenQuery(text: string, aiMsg: DocGenMessage, hooks?: DocGenStreamHooks) {
		// 捕获当前请求ID，用于检查是否被新请求取代
		const requestId = this.currentRequestId;
		const docConfig = this.getDocConfig();
		const { user } = useStore();

		await new Promise<void>((resolve, reject) => {
			let buffer = "";
			let fullContent = "";
			const decoder = createSseDecoder();

			const processSseLine = (rawLine: string) => {
				// 检查是否已中断或请求ID不匹配（说明是旧请求）
				if (this.isAborted || requestId !== this.currentRequestId) return;

				const line = rawLine.trim();
				if (!line) return;

				// 解析 "data: {...}" 格式
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
					const evt = JSON.parse(jsonStr);

					// 处理 workflowMessage 流式响应
					if (evt.workflowMessage) {
						const wm = evt.workflowMessage;
						const nodeStatus = wm.node_status;
						const nodeType = wm.node_type;
						const msgContent = wm.message?.content || "";

						// 更新阶段状态
						if (nodeType === "End" && nodeStatus === "executing") {
							this.updateStage(aiMsg, "analyzing", "completed");
							this.updateStage(aiMsg, "generating", "active", "正在生成文书...");
							this.streamStatus.value = "正在生成文书...";
						}

						// 累积内容
						if (msgContent) {
							fullContent += msgContent;
							aiMsg.content = fullContent;
							hooks?.onTextChunk?.(msgContent);
						}

						// 节点完成
						if (wm.node_is_completed && nodeStatus === "success") {
							this.updateStage(aiMsg, "generating", "completed");
							this.updateStage(aiMsg, "completed", "completed", "生成完成");
						}
					}

					// 处理流式响应（新结构：text + response_type）
					// 累加内容而非覆盖
					if (evt.text) {
						fullContent += evt.text;
						aiMsg.content = fullContent;
						hooks?.onTextChunk?.(evt.text);
					}

					// 记录 response_type（用于判断是否生成文书）
					if (evt.response_type) {
						aiMsg.responseType = evt.response_type as DocResponseType;

						// 更新阶段状态（但不设置 hasDocument，等流式结束后再设置）
						if (evt.response_type === "DOC") {
							this.updateStage(aiMsg, "analyzing", "completed");
							this.updateStage(aiMsg, "generating", "active", "正在生成文书...");
							this.streamStatus.value = "正在生成文书...";
						} else if (evt.response_type === "QUESTION") {
							this.updateStage(aiMsg, "analyzing", "completed");
							this.streamStatus.value = "AI 正在追问...";
						}
					}

					// 保存后端返回的 sessionId（用于多轮对话）
					if (evt.sessionId) {
						this.historySessionId.value = evt.sessionId;
					}

					// 检查是否结束
					if (evt.finishReason === "stop") {
						this.streamStatus.value = null;

						// 最后一条消息包含完整内容，直接替换（解决流式过程中 markdown 格式错乱问题）
						if (evt.text) {
							aiMsg.content = evt.text;
						}

						// 流式结束后，根据 response_type 设置最终状态
						if (aiMsg.responseType === "DOC") {
							aiMsg.hasDocument = true;
							this.updateStage(aiMsg, "generating", "completed");
							this.updateStage(aiMsg, "completed", "completed", "文书生成完成");
						} else if (aiMsg.responseType === "QUESTION") {
							aiMsg.hasDocument = false;
							this.updateStage(aiMsg, "completed", "completed", "请补充信息");
						}
					}
				} catch (err) {
					console.error("[DocGenSession] 解析响应失败", err, jsonStr);
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
					console.error("[DocGenSession] 处理流式数据失败", err);
				}
			};

			const requestTask: any = uni.request({
				url: config.baseUrl + "/law/generateDoc1",
				method: "POST",
				data: {
					content: text,
					type: docConfig.type,
					sessionId: this.historySessionId.value || undefined
				} as any,
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
					const isAbort = this.isAborted || err?.errMsg?.includes("abort");
					if (!isAbort) {
						console.error("[DocGenSession] 请求失败:", err);
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
				console.error("[DocGenSession] 中断请求失败", err);
			}
			this.currentRequestTask = null;
		}
		this.loading.value = false;
		this.streamStatus.value = null;
	}

	/**
	 * 从历史记录恢复会话
	 */
	restoreFromHistory(
		sessionId: string,
		messages: DocGenMessage[],
		docType: DocGenKey,
		historySessionId?: string
	) {
		this.sessionId.value = sessionId;
		this.messages.value = messages;
		this.docType.value = docType;
		this.historySessionId.value = historySessionId || null;
		this.loading.value = false;
		this.streamStatus.value = null;
	}

	clear() {
		this.stopStreaming();
		this.messages.value = [];
		this.sessionId.value = null;
		this.historySessionId.value = null;
		this.docType.value = "complaint";
	}
}

export const docGenSessionStore = new DocGenSessionStore();
