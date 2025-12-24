import { generateUUID, generateRandomString } from "./util";

export const MODULE_SESSION_NAME = {
	// 咨询
	consult: "ai_consult_",
	// 检索
	retrieve: "ai_retrieve_",
	// 法条检索
	retrieveLaw: "ai_retrieve_law_",
	// 案例检索
	retrieveCase: "ai_retrieve_case_",
	// TODO
	// 文书
	doc: "ai_doc_",
	// 起诉状
	lawsuit: "ai_indictment_",
	// 答辩状
	defense: "ai_defense_",
	// TODO
	// 合同
	contract: "ai_contract_",
	// 合同审查
	contractReview: "ai_contract_review_",
	// 合同生成
	contractGenerate: "ai_contract_generate_",
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

// TODO
export const MSG_RECEIVE_BG =
	"https://fxzh01.oss-cn-hangzhou.aliyuncs.com/public/wxmini/msg-receive.wav";
