import { generateUUID, generateRandomString } from "./util";
import type { ChatModuleKey } from "@/cool/store/chatInput-store/types";

/**
 * 模块 Session ID 前缀映射
 */
export const MODULE_SESSION_NAME: Record<ChatModuleKey, string> = {
	consult: "ai_consult_", // 法律咨询
	law: "ai_retrieve_law_", // 法规查询
	case: "ai_retrieve_case_", // 案例检索
	complaint: "ai_complaint_", // 起诉状生成
	defense: "ai_defense_", // 答辩状生成
	contractReview: "ai_contract_review_", // 合同审查
	contractGen: "ai_contract_generate_" // 合同生成
};

/**
 * 创建模块会话 ID
 * @param module 模块 Key（ChatModuleKey）
 */
export const createModelSessionId = (module: ChatModuleKey): string => {
	if (!module) {
		throw new Error("需要指定模块");
	}

	const prefix = MODULE_SESSION_NAME[module];
	if (!prefix) {
		console.warn(`未找到该模块预设 「${module}」,随机生成`);
		return generateUUID();
	}

	return `${prefix}${generateRandomString(8)}`;
};

// TODO
export const MSG_RECEIVE_BG =
	"https://fxzh01.oss-cn-hangzhou.aliyuncs.com/public/wxmini/msg-receive.wav";
