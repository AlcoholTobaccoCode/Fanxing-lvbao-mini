import { ref } from "vue";
import { config } from "@/config";
import { useStore } from "@/cool";
import { recommendLawyers, type RecommendLawyerItem } from "@/api/consult";
import { createModelSessionId } from "@/utils/assetsConfig";
import { SaveMessages, type SaveMessagesPayload } from "@/api/history-chat";
import { generateUUID } from "@/utils/util";
import type { ChatLaunchPayload } from "./flow";
import type { Tools } from "@/components/chat-input/types";

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
	// 是否包含推荐律师信息
	haveRecommendLawyer?: boolean;
	// 推荐律师 ID 列表
	recommendedLawyerIds?: number[];
	// 推荐律师详细信息列表
	recommendedLawyers?: RecommendLawyerItem[];
}

export interface ConsultStreamHooks {
	onTextChunk?: (chunk: string) => void;
}

export class ConsultSessionStore {
	messages = ref<ConsultMessage[]>([]);
	sessionId = ref<string | null>(null);
	loading = ref(false);
	// 当前这轮流式回答的阶段状态文案，例如“正在思考中…”、“正在为您检索相关司法判例…”。
	streamStatus = ref<string | null>(null);
	// 深度思考过程文本（如果开启深度思考）。暂时只存不展示，后续用于“思考过程”折叠面板。
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
		const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
			date.getSeconds()
		)}`;

		const mappedMessages = list.map((m) => {
			return {
				id: generateUUID(),
				content: m.content,
				sender: m.role === "user" ? "user" : "ai",
				timestamp: timeStr,
				// 小程序端目前没有流式中断的概念，这里统一按已完成落库
				isStreaming: false,
				deepThink: m.deepThink,
				haveRecommendLawyer: m.haveRecommendLawyer,
				recommendedLawyerIds: m.recommendedLawyerIds,
				recommendedLawyers: m.recommendedLawyers
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

					// 原始正文片段（可能包含推荐律师标记）
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
					// 1. 先去掉整段 "正在为您推荐律师...<推荐律师>"
					// 2. 再兜底去掉单独的 "<推荐律师>"
					let textChunk = textChunkRaw
						.replace(/正在为您推荐律师.*?<推荐律师>/g, "")
						.replace(/<推荐律师>/g, "");

					if (textChunk) {
						aiMsg.content = textChunk;
						hooks?.onTextChunk?.(textChunk);
					}

					if (deepThinkChunk) {
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
				} catch (err) {
					console.error("解析咨询响应失败", err);
				}
			};

			await new Promise<void>((resolve, reject) => {
				let buffer = "";

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

						if (!chunkStr) {
							return;
						}

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

			// 每轮 AI 回复完成后，先保存当前会话快照
			await this.saveCurrentSessionSnapshot();
			// 再根据 AI 文本中的推荐标记触发推荐律师逻辑（内部会在挂载结果后再保存一次）
			await this.fetchRecommendLawyersIfNeeded(aiMsg);
		} finally {
			this.loading.value = false;
		}
	}

	// 根据当前 AI 消息内容决定是否请求推荐律师，并将结果挂载回消息对象
	private async fetchRecommendLawyersIfNeeded(aiMsg: ConsultMessage) {
		try {
			const { user } = useStore();
			const userId = (user as any)?.info?.value?.id as number | undefined;
			if (!this.sessionId.value || !userId || !aiMsg || !aiMsg.haveRecommendLawyer) {
				return;
			}

			const res = await recommendLawyers({
				session_id: this.sessionId.value,
				// 默认按评分倒序
				sort_by: "rating",
				order: "desc",
				limit: 5
			});
			const list = (res as any)?.data as RecommendLawyerItem[] | undefined;
			if (Array.isArray(list) && list.length) {
				aiMsg.haveRecommendLawyer = true;
				aiMsg.recommendedLawyerIds = list.map((i) => i.user_id);
				aiMsg.recommendedLawyers = list;
				// 推荐结果挂载后，再保存一份包含推荐律师信息的会话快照
				await this.saveCurrentSessionSnapshot();
			}
		} catch (err) {
			console.error("[ConsultSession] 推荐律师失败", err);
		}
	}

	clear() {
		this.messages.value = [];
		this.sessionId.value = null;
	}
}

export const consultSessionStore = new ConsultSessionStore();
