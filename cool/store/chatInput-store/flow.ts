import { ref } from "vue";
import type { Tools } from "@/cool/types/chat-input";
import type { ChatModuleKey, ChatModuleConfig } from "./types";
import { CHAT_MODULE_CONFIGS } from "./moduleConfigs";
import type { LawModelType } from "./lawSession";
import type { CaseModelType } from "./caseSession";

export interface ChatLaunchPayload {
	moduleKey: ChatModuleKey;
	text?: string;
	voice?: any | null;
	files?: any[];
	tools: Tools;
	inputMode: "text" | "voice";
	/** 模型类型 (法规/案例模块使用) */
	modelType?: LawModelType | CaseModelType | undefined;
}

export class ChatFlowStore {
	currentConfig = ref<ChatModuleConfig | null>(null);
	launchPayload = ref<ChatLaunchPayload | null>(null);

	startModule(moduleKey: ChatModuleKey, overrides?: Partial<ChatLaunchPayload>) {
		const config = CHAT_MODULE_CONFIGS[moduleKey];
		this.currentConfig.value = config;

		this.launchPayload.value = {
			moduleKey,
			text: "",
			voice: null,
			files: [],
			tools: [],
			inputMode: "text",
			...overrides
		};
	}

	clear() {
		this.currentConfig.value = null;
		this.launchPayload.value = null;
	}
}

export const chatFlowStore = new ChatFlowStore();
