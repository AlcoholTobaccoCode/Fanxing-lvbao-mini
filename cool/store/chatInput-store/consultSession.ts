import { ref } from "vue";
import { config } from "@/config";
import { useStore } from "@/cool";
import type { ChatLaunchPayload } from "./flow";
import type { Tools } from "@/components/chat-input/types";

export interface ConsultMessage {
	role: "user" | "system";
	content: string;
}

export class ConsultSessionStore {
	messages = ref<ConsultMessage[]>([]);
	sessionId = ref<string | null>(null);
	loading = ref(false);

	initFromLaunch(launch: ChatLaunchPayload) {
		this.messages.value = [];
		this.sessionId.value = null;
	}

	async sendTextQuestion(text: string, tools: Tools) {
		const content = text.trim();
		if (!content || this.loading.value) return;

		// 先追加一条用户消息
		this.messages.value.push({ role: "user", content });

		this.messages.value.push({ role: "system", content: "" });
		const aiMsg = this.messages.value[this.messages.value.length - 1];

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
						contents?: { contentType: string; content: string }[];
					};
					const textChunk = (evt.contents || [])
						.filter((c) => c.contentType === "text")
						.map((c) => c.content)
						.join("");

					if (textChunk) {
						aiMsg.content = textChunk;
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
