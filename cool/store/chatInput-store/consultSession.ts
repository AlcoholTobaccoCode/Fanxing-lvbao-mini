import { ref } from "vue";
import { config } from "@/config";
import { useStore } from "@/cool";
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

	async sendTextQuestion(
		text: string,
		tools: Tools,
		hooks?: ConsultStreamHooks,
		options?: { fromVoice?: boolean; voiceUrl?: string; voiceLength?: number }
	) {
		const content = text.trim();
		if (!content || this.loading.value) return;

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

					// 普通正文片段
					const textChunk = contents
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
		} finally {
			this.loading.value = false;
		}
	}

	clear() {
		this.messages.value = [];
		this.sessionId.value = null;
	}
}

export const consultSessionStore = new ConsultSessionStore();
