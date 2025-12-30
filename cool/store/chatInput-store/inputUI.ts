import { ref, computed } from "vue";
import type { Tools, ToolItem } from "@/cool/types/chat-input";

export type InputMode = "text" | "voice";

/**
 * 聊天输入组件的全局状态 - 管理输入组件的 UI 配置和输入内容
 * 可在任意模块通过 chatInputStore 访问
 */
export class ChatInputStore {
	// ==================== 输入内容 ====================
	/** 当前输入框的文本内容 */
	inputValue = ref("");

	// ==================== UI 配置 ====================
	/** 顶部工具列表（默认工具 + 业务注入工具） */
	tools = ref<Tools>([]);

	/** 当前输入模式：文本 / 语音 */
	inputMode = ref<InputMode>("text");

	/** 占位文案 */
	placeholder = ref("在这里输入你的问题");

	/** 默认工具开关 */
	showDefaultDeepThink = ref(true);
	showDefaultKnowledge = ref(true);
	showDefaultNetwork = ref(true);

	/** 语音录制浮层是否显示 */
	isVoiceRecordVisible = ref(false);

	// ==================== 计算属性 ====================
	/** 是否有输入内容 */
	hasInput = computed(() => !!this.inputValue.value.trim());

	/** 获取已启用的工具列表 */
	enabledTools = computed(() => this.tools.value.filter((t) => t.enable));

	/** 是否启用深度思考 */
	isDeepThinkEnabled = computed(() =>
		this.tools.value.some((t) => t.text === "深度思考" && t.enable)
	);

	/** 是否启用联网搜索 */
	isNetworkEnabled = computed(() =>
		this.tools.value.some((t) => t.text === "联网搜索" && t.enable)
	);

	/** 是否启用知识库 */
	isKnowledgeEnabled = computed(() =>
		this.tools.value.some((t) => t.text === "知识库" && t.enable)
	);

	// ==================== 方法 ====================
	/** 设置输入内容 */
	setInputValue(value: string) {
		this.inputValue.value = value;
	}

	/** 清空输入内容 */
	clearInput() {
		this.inputValue.value = "";
	}

	/** 切换工具启用状态 */
	toggleTool(toolText: string) {
		const tool = this.tools.value.find((t) => t.text === toolText);
		if (tool) {
			tool.enable = !tool.enable;
		}
	}

	/** 设置工具启用状态 */
	setToolEnabled(toolText: string, enabled: boolean) {
		const tool = this.tools.value.find((t) => t.text === toolText);
		if (tool) {
			tool.enable = enabled;
		}
	}

	/** 允许外部一次性写入配置 */
	setConfig(config: {
		inputValue?: string;
		tools?: Tools;
		inputMode?: InputMode;
		placeholder?: string;
		showDefaultDeepThink?: boolean;
		showDefaultKnowledge?: boolean;
		showDefaultNetwork?: boolean;
		isVoiceRecordVisible?: boolean;
	}) {
		if (config.inputValue != null) this.inputValue.value = config.inputValue;
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

	/** 重置所有状态 */
	reset() {
		this.inputValue.value = "";
		this.tools.value = [];
		this.inputMode.value = "text";
		this.placeholder.value = "在这里输入你的问题";
		this.showDefaultDeepThink.value = true;
		this.showDefaultKnowledge.value = true;
		this.showDefaultNetwork.value = true;
		this.isVoiceRecordVisible.value = false;
	}
}

export const chatInputStore = new ChatInputStore();
