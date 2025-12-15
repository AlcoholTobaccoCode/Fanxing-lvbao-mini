import { type UserSessionItem } from "@/api/history-chat";

// 业务类型 & 标签元信息（参考 Web 端 History）
export type HistoryBizType =
	| "consult"
	| "retrieve"
	| "document"
	| "contract_generate"
	| "contract_review";

export interface HistoryBizMeta {
	bizType: HistoryBizType;
	tagLabel: string;
	tagType: "blue" | "green" | "geekblue" | "orange" | "cyan";
}

// 为小程序端实现与 Web 端一致的业务类型推断
export const getBizMetaBySessionId = (sessionId: string): HistoryBizMeta => {
	if (sessionId.startsWith("contract_review_session")) {
		return {
			bizType: "contract_review",
			tagLabel: "审查",
			tagType: "geekblue"
		};
	}

	if (sessionId.startsWith("ai-session_retrieve")) {
		return {
			bizType: "retrieve",
			tagLabel: "检索",
			tagType: "orange"
		};
	}

	if (sessionId.startsWith("ai-session_doc")) {
		return {
			bizType: "document",
			tagLabel: "文书",
			tagType: "cyan"
		};
	}

	if (sessionId.startsWith("ai-session_contract")) {
		return {
			bizType: "contract_generate",
			tagLabel: "生成",
			tagType: "blue"
		};
	}

	if (sessionId.startsWith("ai-session_consult")) {
		return {
			bizType: "consult",
			tagLabel: "咨询",
			tagType: "green"
		};
	}

	return {
		bizType: "consult",
		tagLabel: "咨询",
		tagType: "green"
	};
};

export interface HistorySessionItem extends UserSessionItem, HistoryBizMeta {}
