export type ConsultPreset = string;

export type SearchType = "law" | "case";
export type DocumentType = "indictment" | "defense";
export type ContractType = "generate" | "review";

// 咨询模块 - 预设问题
export const consultPresets: ConsultPreset[] = [
	"如何注册商标并保障我的商标权益？",
	"离婚时共同财产一般如何分割？",
	"遭遇网络诈骗后，我应该立刻怎么做？"
];

// 检索模块 - 不同类型的预设问题
export const searchPresets: Record<SearchType, string[]> = {
	law: [
		"请检索杭州市近三年颁布的与物业管理相关的法规。",
		"请检索关于侵犯他人隐私的相关法条。",
		"请检索南京市近5年对于摩托车骑行的法规。"
	],
	case: [
		"请检索近期关于遗产继承纠纷的典型案例。",
		"请检索商标侵权案件中原告胜诉的案例。",
		"请检索劳动争议中员工获得经济补偿的案例。"
	]
};

// 文书模块 - 起诉状 / 答辩状预设问题
export const documentPresets: Record<DocumentType, string[]> = {
	indictment: [
		"帮我生成一份民事起诉状草稿。",
		"根据这个案情，起草一份起诉状。",
		"优化一下我现有的起诉状，让结构更清晰。"
	],
	defense: [
		"根据这个案情，帮我起草一份刑事答辩状。",
		"请根据以下案情撰写一份民事答辩状。",
		"优化一下我现有的答辩状，让逻辑更严谨。"
	]
};

// 合同模块 - 生成 / 审核预设问题
export const contractPresets: Record<ContractType, string[]> = {
	generate: [
		"根据以下要点帮我生成一份劳动合同草稿。",
		"请帮我生成一份房屋租赁合同，租期一年，月租金3000元，押一付三。",
		"根据以下条款，帮我起草一份合作协议。"
	],
	review: [
		"请帮我审核这份买卖合同是否存在明显风险。",
		"从乙方角度帮我看看这份租赁合同有哪些不公平条款。",
		"根据以下合同内容，提示可能的法律风险。"
	]
};
