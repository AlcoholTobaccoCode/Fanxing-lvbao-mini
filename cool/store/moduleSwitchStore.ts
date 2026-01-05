import { ref, computed } from "vue";
import type { ChatModuleKey } from "./chatInput-store/types";
import { CHAT_MODULE_CONFIGS } from "./chatInput-store/moduleConfigs";

// 模块 Tab 配置
export interface ModuleTabItem {
	label: string;
	value: ChatModuleKey;
	disabled?: boolean;
}

// Tab 列表配置
export const MODULE_TAB_LIST: ModuleTabItem[] = [
	{ label: "咨询", value: "consult" },
	{ label: "法规", value: "law" },
	{ label: "案例", value: "case" },
	{ label: "起诉状", value: "complaint" },
	{ label: "答辩状", value: "defense" },
	{ label: "合同生成", value: "contractGen" }
	// { label: "合同审查", value: "contractReview", disabled: true }
];

// 当前选中的模块
const currentModule = ref<ChatModuleKey>("consult");

// 获取当前模块配置
const currentConfig = computed(() => {
	return CHAT_MODULE_CONFIGS[currentModule.value];
});

// 切换模块
const switchModule = (moduleKey: ChatModuleKey) => {
	const tabItem = MODULE_TAB_LIST.find((item) => item.value === moduleKey);
	if (tabItem?.disabled) {
		console.warn(`模块 ${moduleKey} 已禁用`);
		uni.showToast({
			title: `模块 ${moduleKey} 已禁用`,
			icon: "none",
			mask: true
		});
		return false;
	}
	currentModule.value = moduleKey;
	return true;
};

// 重置为默认模块
const resetModule = () => {
	currentModule.value = "consult";
};

export const moduleSwitchStore = {
	currentModule,
	currentConfig,
	tabList: MODULE_TAB_LIST,
	switchModule,
	resetModule
};
