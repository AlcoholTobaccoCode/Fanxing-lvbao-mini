// ==================== 咨询模块 ====================
export const CONSULT_QUICK_QUESTIONS: string[] = [
	"如何确定劳动合同的生效时间？",
	"法院的判决和裁定如何执行？",
	"劳动合同不公平，怎么解决？",
	"如何确定借款合同的利率与利息合法性？",
	"劳动仲裁的程序怎么走？",
	"借条怎么打，才具有法律效应？",
	"离婚时的财产如何分割？",
	"如何确定未成年子女的抚养权归属？",
	"外包工人受伤时，如何保证赔偿？",
	"离婚协议未履行，如何处理？",
	"交通事故发生后如何收集证据？",
	"婚姻中一方有过错，如何追究法律责任？",
	"夫妻间财务问题如何解决？",
	"无证驾驶事故责任如何分担？",
	"交通事故中的赔偿问题，如何解决？"
];

// 兼容旧名称
export const LEGAL_QUICK_QUESTIONS = CONSULT_QUICK_QUESTIONS;

// ==================== 法规模块 ====================
export const LAW_CATEGORIES = [
	{ label: "民法典", icon: "fxzh-falvfagui" },
	{ label: "刑法", icon: "fxzh-falvfagui" },
	{ label: "劳动法", icon: "fxzh-falvfagui" }
	// { label: "公司法", icon: "fxzh-falvfagui" },
	// { label: "合同法", icon: "fxzh-falvfagui" },
	// { label: "婚姻法", icon: "fxzh-falvfagui" }
];

export const LAW_HOT_ITEMS: string[] = [
	"民法典第一千零六十四条 夫妻共同债务",
	"劳动合同法第四十七条 经济补偿金计算",
	"民法典第五百七十七条 违约责任"
];

// ==================== 案例模块 ====================
export const CASE_TYPES = [
	{ label: "合同纠纷", icon: "file-list-line", desc: "" },
	{ label: "劳动争议", icon: "file-list-line", desc: "" },
	{ label: "离婚纠纷", icon: "file-list-line", desc: "" }
	// "民间借贷",
	// "交通事故",
	// "人身损害"
];

export const CASE_COURT_LEVELS = [
	{ label: "最高法", value: "supreme" },
	{ label: "高级法院", value: "high" },
	{ label: "中级法院", value: "intermediate" },
	{ label: "基层法院", value: "basic" }
];

export const CASE_HOT_ITEMS: string[] = [
	"彭宇案 - 扶不扶的法律边界",
	"于欢案 - 正当防卫的认定标准",
	"江歌案 - 侵权责任与因果关系"
];

// ==================== 起诉状模块 ====================
export const COMPLAINT_CATEGORIES = [
	// { label: "民事起诉", icon: "file-list-line", desc: "合同、侵权等" },
	// { label: "劳动仲裁", icon: "file-list-line", desc: "劳动争议申请书" },
	// { label: "行政起诉", icon: "file-list-line", desc: "行政复议、诉讼" }
	{ label: "民事起诉", icon: "file-list-line", desc: "" },
	{ label: "劳动仲裁", icon: "file-list-line", desc: "" },
	{ label: "行政起诉", icon: "file-list-line", desc: "" }
];

export const COMPLAINT_STEPS = [
	{ num: 1, title: "描述案情", desc: "简要说明纠纷经过" },
	{ num: 2, title: "明确诉求", desc: "你希望法院如何判决" },
	{ num: 3, title: "智能生成", desc: "AI 自动生成规范文书" }
];

export const COMPLAINT_TEMPLATES: string[] = ["借款纠纷起诉状", "劳动争议仲裁申请书", "离婚起诉状"];

// ==================== 答辩状模块 ====================
export const DEFENSE_TYPES = [
	{ label: "民事答辩", icon: "shield-check-line", desc: "应对民事起诉" },
	{ label: "仲裁答辩", icon: "shield-check-line", desc: "劳动仲裁答辩" },
	{ label: "行政答辩", icon: "shield-check-line", desc: "行政诉讼应诉" }
];

export const DEFENSE_TIPS = [
	{ title: "事实抗辩", desc: "对原告陈述事实的反驳" },
	{ title: "法律抗辩", desc: "法律适用、时效等问题" },
	{ title: "证据抗辩", desc: "对证据真实性、关联性质疑" }
];

export const DEFENSE_SCENARIOS: string[] = [
	"收到法院传票，需要准备答辩状",
	"被劳动仲裁，如何应对",
	"合同纠纷被起诉，如何反驳"
];

// ==================== 合同审查模块 ====================
export const CONTRACT_REVIEW_TYPES: string[] = [
	"劳动合同",
	"租赁合同",
	"买卖合同",
	"借款合同",
	"服务合同",
	"合作协议"
];

export const CONTRACT_REVIEW_POINTS = [
	{ icon: "checkbox-circle-line", title: "条款完整性", desc: "检查必备条款是否齐全" },
	{ icon: "error-warning-line", title: "风险条款", desc: "识别不公平或有风险条款" },
	{ icon: "scales-3-line", title: "法律合规", desc: "确保符合现行法律法规" },
	{ icon: "edit-line", title: "修改建议", desc: "提供专业修改意见" }
];

// ==================== 合同生成模块 ====================
export const CONTRACT_GEN_CATEGORIES = [
	{ label: "劳动用工", icon: "profile-line", templates: ["劳动合同", "劳务协议", "保密协议"] },
	{ label: "房屋租赁", icon: "home-line", templates: ["房屋租赁", "商铺租赁", "转租协议"] },
	{
		label: "买卖交易",
		icon: "shopping-bag-line",
		templates: ["买卖合同", "采购协议", "分销合同"]
	}
	// {
	// 	label: "借贷融资",
	// 	icon: "money-cny-circle-line",
	// 	templates: ["借款合同", "担保协议", "抵押合同"]
	// },
	// { label: "合作经营", icon: "store-2-line", templates: ["合作协议", "股权转让", "投资协议"] },
	// {
	// 	label: "服务委托",
	// 	icon: "customer-service-line",
	// 	templates: ["服务协议", "委托代理", "咨询合同"]
	// }
];

export const CONTRACT_GEN_HOT_TEMPLATES: string[] = [
	"标准劳动合同",
	"房屋租赁合同",
	"民间借贷协议",
	"保密协议 NDA"
];
