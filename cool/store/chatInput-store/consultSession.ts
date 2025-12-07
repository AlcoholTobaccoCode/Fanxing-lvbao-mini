import { ref } from "vue";
import { config } from "@/config";
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

		if (launch.text) {
			this.messages.value.push({ role: "user", content: launch.text });
		}
	}

	async sendTextQuestion(text: string, tools: Tools) {
		const content = text.trim();
		if (!content || this.loading.value) return;

		this.messages.value.push({ role: "user", content });

		const aiMsg: ConsultMessage = { role: "system", content: "" };
		this.messages.value.push(aiMsg);

		const deepThink = tools?.some((t) => t.text === "深度思考" && t.enable);
		const onlineSearch = tools?.some((t) => t.text === "联网搜索" && t.enable);

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
			// #ifdef H5
			const resp = await fetch(config.baseUrl + "/law/consult", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(payload)
			});

			if (!resp.body) {
				throw new Error("响应不支持流式 body");
			}

			const reader = resp.body.getReader();
			const decoder = new TextDecoder("utf-8");
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				const parts = buffer.split("\n\n");
				buffer = parts.pop() || "";

				for (const part of parts) {
					const line = part.trim();
					if (!line.startsWith("data:")) continue;

					const jsonStr = line.slice(5).trim();
					if (!jsonStr) continue;

					try {
						const evt = JSON.parse(jsonStr) as {
							contents?: { contentType: string; content: string }[];
						};
						const textChunk = (evt.contents || [])
							.filter((c) => c.contentType === "text")
							.map((c) => c.content)
							.join("");

						if (textChunk) {
							aiMsg.content += textChunk;
						}
					} catch (err) {
						console.error("解析流式响应失败", err);
					}
				}
			}
			// #endif
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
