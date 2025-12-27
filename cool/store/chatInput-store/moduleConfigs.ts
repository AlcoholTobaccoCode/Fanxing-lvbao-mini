import type { ChatModuleKey, ChatModuleConfig } from "./types";

export const CHAT_MODULE_CONFIGS: Record<ChatModuleKey, ChatModuleConfig> = {
	consult: {
		key: "consult",
		title: "法律咨询",
		detailRoute: "/ai-chat-module/consult/index",
		enableVoice: true,
		enableFileUpload: false,
		enableDeepThink: true,
		enableKnowledge: true,
		enableNetwork: true,
		placeholder: "请简要描述您的法律问题…"
	},
	law: {
		key: "law",
		title: "法规查询",
		detailRoute: "/ai-chat-module/law/index",
		enableVoice: true,
		enableFileUpload: false,
		enableDeepThink: false,
		enableKnowledge: true,
		enableNetwork: false,
		placeholder: "输入法规名称或关键词进行查询…"
	},
	case: {
		key: "case",
		title: "案例检索",
		detailRoute: "/ai-chat-module/case/index",
		enableVoice: true,
		enableFileUpload: false,
		enableDeepThink: false,
		enableKnowledge: false,
		enableNetwork: false,
		placeholder: "输入案由或关键词检索相似案例…"
	},
	complaint: {
		key: "complaint",
		title: "起诉状生成",
		detailRoute: "/ai-chat-module/complaint/index",
		enableVoice: true,
		enableFileUpload: false,
		enableDeepThink: false,
		enableKnowledge: false,
		enableNetwork: false,
		placeholder: "描述案件情况，帮你生成起诉状…"
	},
	defense: {
		key: "defense",
		title: "答辩状生成",
		detailRoute: "/ai-chat-module/defense/index",
		enableVoice: true,
		enableFileUpload: false,
		enableDeepThink: false,
		enableKnowledge: false,
		enableNetwork: false,
		placeholder: "描述被诉情况，帮你生成答辩状…"
	},
	contractReview: {
		key: "contractReview",
		title: "合同审查",
		detailRoute: "/ai-chat-module/contract-review/index",
		enableVoice: false,
		enableFileUpload: false,
		enableDeepThink: false,
		enableKnowledge: false,
		enableNetwork: false,
		placeholder: "上传或粘贴合同内容进行审查…"
	},
	contractGen: {
		key: "contractGen",
		title: "合同生成",
		detailRoute: "/ai-chat-module/contract-gen/index",
		enableVoice: true,
		enableFileUpload: false,
		enableDeepThink: false,
		enableKnowledge: false,
		enableNetwork: false,
		placeholder: "描述合同需求，帮你生成合同…"
	}
};
