import type { ChatModuleKey, ChatModuleConfig } from "./types";

export const CHAT_MODULE_CONFIGS: Record<ChatModuleKey, ChatModuleConfig> = {
	consult: {
		key: "consult",
		title: "法律咨询",
		detailRoute: "/pages/consult/chat", // 咨询详情对话页
		enableVoice: true,
		enableFileUpload: false,
		enableDeepThink: true,
		enableKnowledge: true,
		enableNetwork: true,
		placeholder: "请简要描述您的法律问题…"
	},
	contract: {
		key: "contract",
		title: "合同审查",
		detailRoute: "/pages/contract/detail",
		enableVoice: false,
		enableFileUpload: true,
		enableDeepThink: true,
		enableKnowledge: true,
		enableNetwork: true,
		placeholder: "上传或粘贴合同内容，我来帮你审查…"
	},
	caseSearch: {
		key: "caseSearch",
		title: "判例检索",
		detailRoute: "/pages/case-search/detail",
		enableVoice: true,
		enableFileUpload: false,
		enableDeepThink: false,
		enableKnowledge: true,
		enableNetwork: true,
		placeholder: "请输入案情关键词，例如：租赁合同纠纷…"
	},
	docAnalysis: {
		key: "docAnalysis",
		title: "文书分析",
		detailRoute: "/pages/doc-analysis/detail",
		enableVoice: false,
		enableFileUpload: true,
		enableDeepThink: true,
		enableKnowledge: true,
		enableNetwork: false,
		placeholder: "上传或粘贴裁判文书，我来帮你分析…"
	},
	module5: {
		key: "module5",
		title: "模块5",
		detailRoute: "/pages/module5/detail",
		enableVoice: true,
		enableFileUpload: false,
		enableDeepThink: false,
		enableKnowledge: false,
		enableNetwork: false,
		placeholder: "模块5 占位提示…"
	},
	module6: {
		key: "module6",
		title: "模块6",
		detailRoute: "/pages/module6/detail",
		enableVoice: true,
		enableFileUpload: false,
		enableDeepThink: false,
		enableKnowledge: false,
		enableNetwork: false,
		placeholder: "模块6 占位提示…"
	},
	module7: {
		key: "module7",
		title: "模块7",
		detailRoute: "/pages/module7/detail",
		enableVoice: true,
		enableFileUpload: false,
		enableDeepThink: false,
		enableKnowledge: false,
		enableNetwork: false,
		placeholder: "模块7 占位提示…"
	}
};
