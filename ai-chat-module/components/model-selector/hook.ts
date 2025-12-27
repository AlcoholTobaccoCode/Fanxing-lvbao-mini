/**
 * 模型配置项
 */
export interface ModelOption {
	key: string;
	icon: string;
	label: string;
	desc: string;
	recommend?: boolean;
}

/** 检索类型 */
export type SearchType = "law" | "case";

/** 模型 key 映射 */
export type ModelKey = "flash" | "plus" | "max";

/**
 * 模型配置表
 * - flash: 法宝（通用版）
 * - plus: 律之星（法规专业版）
 * - max: 法睿（案例专业版）
 */
const MODEL_CONFIG: Record<ModelKey, ModelOption> = {
	flash: { key: "fabao", icon: "🌐", label: "通用版", desc: "全域法律智能中枢", recommend: true },
	plus: { key: "lzx", icon: "🗼", label: "专业版", desc: "拥有过硬的专业法律知识" },
	max: { key: "farui", icon: "💭", label: "专业版", desc: "法律思维引擎" }
};

/**
 * 根据检索类型返回允许选择的模型列表
 * - 法规：flash（法宝）+ plus（律之星）
 * - 案例：flash（法宝）+ max（法睿）
 */
export function getModelOptionsBySearchType(searchType: SearchType): ModelOption[] {
	if (searchType === "law") {
		return [MODEL_CONFIG.flash, MODEL_CONFIG.plus];
	}
	return [MODEL_CONFIG.flash, MODEL_CONFIG.max];
}
