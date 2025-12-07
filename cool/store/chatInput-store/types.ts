// 聊天模块枚举（先预留 7 个子模块位）
export type ChatModuleKey =
	| "consult" // 咨询
	| "contract" // 合同审查
	| "caseSearch" // 判例检索
	| "docAnalysis" // 文书分析
	| "module5"
	| "module6"
	| "module7";

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
