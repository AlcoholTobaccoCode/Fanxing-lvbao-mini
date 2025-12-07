import { ref } from "vue";
import type { Tools } from "@/components/chat-input/types";

export type InputMode = "text" | "voice";

/**
 * 聊天输入组件的全局状态（配置） - 仅负责输入组件自身的 UI 配置
 */
export class ChatInputStore {
	// 顶部工具列表（默认工具 + 业务注入工具）
	tools = ref<Tools>([]);

	// 当前输入模式：文本 / 语音
	inputMode = ref<InputMode>("text");

	// 占位文案
	placeholder = ref("在这里输入你的问题");

	// 默认工具开关
	showDefaultDeepThink = ref(true);
	showDefaultKnowledge = ref(true);
	showDefaultNetwork = ref(true);

	// 语音录制浮层是否显示
	isVoiceRecordVisible = ref(false);

	// 允许外部一次性写入配置
	setConfig(config: {
		tools?: Tools;
		inputMode?: InputMode;
		placeholder?: string;
		showDefaultDeepThink?: boolean;
		showDefaultKnowledge?: boolean;
		showDefaultNetwork?: boolean;
		isVoiceRecordVisible?: boolean;
	}) {
		if (config.tools) this.tools.value = config.tools;
		if (config.inputMode) this.inputMode.value = config.inputMode;
		if (config.placeholder != null) this.placeholder.value = config.placeholder;
		if (config.showDefaultDeepThink != null)
			this.showDefaultDeepThink.value = config.showDefaultDeepThink;
		if (config.showDefaultKnowledge != null)
			this.showDefaultKnowledge.value = config.showDefaultKnowledge;
		if (config.showDefaultNetwork != null)
			this.showDefaultNetwork.value = config.showDefaultNetwork;
		if (config.isVoiceRecordVisible != null)
			this.isVoiceRecordVisible.value = config.isVoiceRecordVisible;
	}
}

export const chatInputStore = new ChatInputStore();
