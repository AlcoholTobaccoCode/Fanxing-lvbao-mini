import { ref } from "vue";
import type { ChatLaunchPayload } from "./flow";

export interface ConsultMessage {
	role: "user" | "ai" | "system";
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

	clear() {
		this.messages.value = [];
		this.sessionId.value = null;
	}
}

export const consultSessionStore = new ConsultSessionStore();
