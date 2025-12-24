// 聊天模块枚举
export type ChatModuleKey =
	| "consult" // 咨询
	| "law" // 法规查询
	| "case" // 案例检索
	| "complaint" // 起诉状
	| "defense" // 答辩状
	| "contractReview" // 合同审查
	| "contractGen"; // 合同生成

// 每个模块的基础配置
export interface ChatModuleConfig {
	key: ChatModuleKey;
	title: string; // 模块标题
	detailRoute: string; // 对应详情页路由
	enableVoice: boolean;
	enableFileUpload: boolean;
	enableDeepThink: boolean;
	enableKnowledge: boolean;
	enableNetwork: boolean;
	placeholder: string; // 起始/详情页通用占位提示
}
