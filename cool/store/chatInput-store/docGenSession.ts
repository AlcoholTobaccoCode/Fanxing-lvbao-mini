import { ref } from "vue";
import { config } from "@/config";
import { useStore } from "@/cool";
import { SaveMessages, type SaveMessagesPayload } from "@/api/history-chat";
import { generateUUID, generateRandomString } from "@/utils/util";
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
 * 文书生成消息
 */
export interface DocGenMessage {
	role: "user" | "system";
	content: string;
	fromVoice?: boolean;
	voiceUrl?: string;
	voiceLength?: number;
	stages?: DocGenStageItem[];
	/** 是否检测到完整文书 */
	hasDocument?: boolean;
	/** 提取的完整文书内容（用于导出） */
	documentContent?: string;
}

export interface DocGenStreamHooks {
	onTextChunk?: (chunk: string) => void;
}

/**
 * 检测文本中是否包含完整的文书内容
 * 根据特定标题格式判断（如 "# 劳 动 合 同"、"# 民事起诉状"、"# 民事答辩状"）
 */
export function detectDocumentInText(text: string): {
	hasDocument: boolean;
	documentContent?: string;
} {
	// 文书标题匹配模式
	const documentPatterns = [
		// 合同类
		/^#\s*[\u4e00-\u9fa5\s]+合\s*同/m,
		/^#+\s*劳\s*动\s*合\s*同/m,
		/^#+\s*租\s*赁\s*合\s*同/m,
		/^#+\s*买\s*卖\s*合\s*同/m,
		/^#+\s*服\s*务\s*合\s*同/m,
		/^#+\s*借\s*款\s*合\s*同/m,
		/^#+\s*委\s*托\s*合\s*同/m,
		/^#+\s*合\s*作\s*合\s*同/m,
		/^#+\s*股\s*权\s*转\s*让.*协\s*议/m,
		// 起诉状类
		/^#+\s*民\s*事\s*起\s*诉\s*状/m,
		/^#+\s*刑\s*事\s*自\s*诉\s*状/m,
		/^#+\s*行\s*政\s*起\s*诉\s*状/m,
		// 答辩状类
		/^#+\s*民\s*事\s*答\s*辩\s*状/m,
		/^#+\s*刑\s*事\s*答\s*辩\s*状/m,
		/^#+\s*行\s*政\s*答\s*辩\s*状/m,
		// 通用法律文书
		/^#+\s*[\u4e00-\u9fa5]+\s*协\s*议\s*书/m
	];

	for (const pattern of documentPatterns) {
		if (pattern.test(text)) {
			// 尝试提取文书内容（从标题开始到文末或下一个主要分隔符）
			const match = text.match(pattern);
			if (match) {
				const startIndex = text.indexOf(match[0]);
				const documentContent = text.slice(startIndex);
				return { hasDocument: true, documentContent };
			}
		}
	}

	return { hasDocument: false };
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
			voiceLength: m.voiceLength
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

		this.loading.value = true;
		this.streamStatus.value = "正在分析需求...";

		try {
			await this.sendDocGenQuery(content, aiMsg, hooks);
			this.streamStatus.value = null;
			await this.saveCurrentSessionSnapshot();
		} catch (err) {
			console.error("[DocGenSession] 生成失败", err);
			aiMsg.content = "生成失败，请稍后重试";
			aiMsg.stages = [{ stage: "completed", status: "completed", message: "生成失败" }];
			this.streamStatus.value = null;
		} finally {
			this.loading.value = false;
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
		const docConfig = this.getDocConfig();
		const { user } = useStore();

		await new Promise<void>((resolve, reject) => {
			let buffer = "";
			let fullContent = "";

			const processSseLine = (rawLine: string) => {
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

					// 处理最终响应
					if (evt.text) {
						aiMsg.content = evt.text;
						fullContent = evt.text;

						// 检测是否包含完整文书
						const detection = detectDocumentInText(evt.text);
						aiMsg.hasDocument = detection.hasDocument;
						if (detection.documentContent) {
							aiMsg.documentContent = detection.documentContent;
						}

						this.updateStage(aiMsg, "completed", "completed", "生成完成");
					}

					// 保存后端返回的 sessionId（用于多轮对话）
					if (evt.sessionId) {
						this.historySessionId.value = evt.sessionId;
					}

					// 检查是否结束
					if (evt.finishReason === "stop") {
						this.streamStatus.value = null;
					}
				} catch (err) {
					console.error("[DocGenSession] 解析响应失败", err, jsonStr);
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
					console.error("[DocGenSession] 请求失败:", err);
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
		this.messages.value = [];
		this.sessionId.value = null;
		this.historySessionId.value = null;
		this.docType.value = "complaint";
	}
}

export const docGenSessionStore = new DocGenSessionStore();
