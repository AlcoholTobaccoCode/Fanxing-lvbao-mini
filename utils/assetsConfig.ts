import { generateUUID, generateRandomString } from "./util";

// 用户默认头像
export const USER_DEFAULT_AVATAR = "/static/user/avatar.png";

export const MODULE_SESSION_NAME = {
	// 咨询
	consult: "ai_consult_",
	// 合同
	contract: "ai_contract_",
	// 文书
	doc: "ai_doc_",
	// 检索
	retrieve: "ai_retrieve_",
	// 律师对话
	lawyerChat: ""
};

export const createModelSessionId = (module: string): string => {
	if (!module) {
		throw new Error("需要指定模块");
	}

	const moduleStr = MODULE_SESSION_NAME[module] || null;
	if (!moduleStr) {
		console.warn(`未找到该模块预设 「${module}」,随机生成`);
		return generateUUID();
	}

	return `${moduleStr}${generateRandomString(8)}`;
};

// 咨询模块默认问题
export const LEGAL_QUICK_QUESTIONS: string[] = [
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
