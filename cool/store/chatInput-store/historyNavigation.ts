/**
 * 历史记录导航服务
 * 负责从历史记录跳转到对应的聊天页面
 */
import { useStore } from "@/cool";
import { LoadMessages } from "@/api/history-chat";
import { chatFlowStore } from "./flow";
import { consultSessionStore, type ConsultMessage } from "./consultSession";
import { lawSessionStore, type LawMessage } from "./lawSession";
import { caseSessionStore, type CaseMessage } from "./caseSession";
import {
	docGenSessionStore,
	type DocGenMessage,
	type DocGenKey,
	detectDocumentInText
} from "./docGenSession";
import { CHAT_MODULE_CONFIGS } from "./moduleConfigs";
import type { ChatModuleKey } from "./types";
import type {
	HistoryBizType,
	HistorySessionItem
} from "@/components/common/layout/app-setting/hook";

/**
 * 业务类型到模块 Key 的映射
 * HistoryBizType → ChatModuleKey
 */
const BIZ_TYPE_TO_MODULE: Record<HistoryBizType, ChatModuleKey | null> = {
	consult: "consult", // 法律咨询
	retrieve: "case", // 案例检索
	document: "law", // 法规查询
	complaint: "complaint", // 起诉状
	defense: "defense", // 答辩状
	contract_generate: "contractGen", // 合同生成
	contract_review: "contractReview" // 合同审查
};

/**
 * 从历史记录导航到对应的聊天页面
 */
export async function navigateToHistorySession(item: HistorySessionItem): Promise<boolean> {
	const { user } = useStore();
	const userId = user.info.value?.id;

	if (!userId) {
		uni.showToast({ title: "请先登录", icon: "none" });
		return false;
	}

	const moduleKey = BIZ_TYPE_TO_MODULE[item.bizType];

	if (!moduleKey) {
		uni.showToast({ title: "暂不支持该类型", icon: "none" });
		return false;
	}

	const config = CHAT_MODULE_CONFIGS[moduleKey];

	if (!config) {
		uni.showToast({ title: "模块配置不存在", icon: "none" });
		return false;
	}

	try {
		uni.showLoading({ title: "加载中..." });

		// 加载历史消息
		const res = await LoadMessages({
			user_id: userId,
			session_id: item.session_id
		});

		const sessionData = (res as any)?.message ?? {};

		// 根据模块类型分发处理
		switch (moduleKey) {
			case "consult":
				await restoreConsultSession(item.session_id, sessionData);
				break;
			case "law":
				await restoreLawSession(item.session_id, sessionData);
				break;
			case "case":
				await restoreCaseSession(item.session_id, sessionData);
				break;
			case "complaint":
				await restoreDocGenSession(item.session_id, sessionData, "complaint");
				break;
			case "defense":
				await restoreDocGenSession(item.session_id, sessionData, "defense");
				break;
			case "contractGen":
				await restoreDocGenSession(item.session_id, sessionData, "contractGen");
				break;
			case "contractReview":
			default:
				uni.hideLoading();
				uni.showToast({ title: "该功能即将上线", icon: "none" });
				return false;
		}

		uni.hideLoading();

		// 跳转到详情页
		uni.navigateTo({
			url: `${config.detailRoute}?fromHistory=true&sessionId=${item.session_id}`
		});

		return true;
	} catch (err) {
		console.error("[historyNavigation] 加载历史记录失败", err);
		uni.hideLoading();
		uni.showToast({ title: "加载失败，请重试", icon: "none" });
		return false;
	}
}

/**
 * 恢复咨询会话
 */
async function restoreConsultSession(sessionId: string, sessionData: any): Promise<void> {
	// 解析消息列表
	const messages = sessionData?.messages ?? [];

	// 转换为 ConsultMessage 格式 (兼容新旧数据：优先读 role，没有再读 sender)
	const consultMessages: ConsultMessage[] = messages.map((msg: any) => ({
		role: msg.role ?? (msg.sender === "user" ? "user" : "system"),
		content: msg.content || "",
		fromVoice: false,
		voiceUrl: undefined,
		voiceLength: undefined,
		deepThink: msg.deepThink,
		deepThinkStartTime: msg.thinkingTime ? Date.now() - msg.thinkingTime * 1000 : undefined,
		deepThinkEndTime: msg.thinkingTime ? Date.now() : undefined,
		recommendedLawyers: msg.recommendedLawyers || [],
		references: msg.references || {
			searchList: [],
			lawList: [],
			caseList: []
		}
	}));

	// 设置 chatFlowStore 启动参数
	chatFlowStore.startModule("consult", {
		text: "",
		tools: [],
		inputMode: "text"
	});

	// 恢复 consultSessionStore
	consultSessionStore.restoreFromHistory(sessionId, consultMessages);
}

/**
 * 恢复法规查询会话
 */
async function restoreLawSession(sessionId: string, sessionData: any): Promise<void> {
	const messages = sessionData?.messages ?? [];
	const modelType = sessionData?.modelType; // 读取保存的模型类型

	const lawMessages: LawMessage[] = messages.map((msg: any) => ({
		role: msg.role ?? (msg.sender === "user" ? "user" : "system"),
		content: msg.content || "",
		fromVoice: false,
		voiceUrl: undefined,
		voiceLength: undefined,
		// 直接透传 references
		references: msg.references
	}));

	chatFlowStore.startModule("law", {
		text: "",
		tools: [],
		inputMode: "text",
		modelType // 传递模型类型
	});

	// 传递 modelType 给 restoreFromHistory
	lawSessionStore.restoreFromHistory(sessionId, lawMessages, modelType);
}

/**
 * 恢复案例检索会话
 */
async function restoreCaseSession(sessionId: string, sessionData: any): Promise<void> {
	const messages = sessionData?.messages ?? [];
	const modelType = sessionData?.modelType; // 读取保存的模型类型

	const caseMessages: CaseMessage[] = messages.map((msg: any) => ({
		role: msg.role ?? (msg.sender === "user" ? "user" : "system"),
		content: msg.content || "",
		fromVoice: false,
		voiceUrl: undefined,
		voiceLength: undefined,
		// 直接透传 references (兼容新旧格式: 数组或对象)
		references: msg.references
	}));

	chatFlowStore.startModule("case", {
		text: "",
		tools: [],
		inputMode: "text",
		modelType // 传递模型类型
	});

	// 传递 modelType 给 restoreFromHistory
	caseSessionStore.restoreFromHistory(sessionId, caseMessages, modelType);
}

/**
 * 恢复文书生成会话（起诉状/答辩状/合同生成）
 */
async function restoreDocGenSession(
	sessionId: string,
	sessionData: any,
	docType: DocGenKey
): Promise<void> {
	const messages = sessionData?.messages ?? [];
	const historySessionId = sessionData?.historySessionId; // 后端返回的会话ID（用于多轮对话）

	// 转换为 DocGenMessage 格式
	const docGenMessages: DocGenMessage[] = messages.map((msg: any) => {
		const content = msg.content || "";
		const role = msg.role ?? (msg.sender === "user" ? "user" : "system");

		// 对于 AI 消息，检测是否包含完整文书
		let hasDocument = false;
		let documentContent: string | undefined;
		if (role === "system" && content) {
			const detection = detectDocumentInText(content);
			hasDocument = detection.hasDocument;
			documentContent = detection.documentContent;
		}

		return {
			role: role as "user" | "system",
			content,
			fromVoice: false,
			voiceUrl: undefined,
			voiceLength: undefined,
			stages: msg.stages,
			hasDocument,
			documentContent
		};
	});

	// 启动模块
	chatFlowStore.startModule(docType, {
		text: "",
		tools: [],
		inputMode: "text"
	});

	// 恢复 docGenSessionStore
	docGenSessionStore.restoreFromHistory(sessionId, docGenMessages, docType, historySessionId);
}

/**
 * 导出类型供外部使用
 */
export type { HistoryBizType, HistorySessionItem };
