/**
 * 历史记录导航服务
 * 负责从历史记录跳转到对应的聊天页面
 */
import { useStore } from "@/cool";
import { LoadMessages } from "@/api/history-chat";
import { chatFlowStore } from "./flow";
import { consultSessionStore, type ConsultMessage } from "./consultSession";
import { CHAT_MODULE_CONFIGS } from "./moduleConfigs";
import type { ChatModuleKey } from "./types";
import type {
	HistoryBizType,
	HistorySessionItem
} from "@/components/common/layout/app-setting/hook";

/**
 * 业务类型到模块 Key 的映射
 */
const BIZ_TYPE_TO_MODULE: Record<HistoryBizType, ChatModuleKey | null> = {
	consult: "consult",
	retrieve: "caseSearch",
	document: "docAnalysis",
	contract_generate: "contract",
	contract_review: "contract"
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
			case "contract":
			case "caseSearch":
			case "docAnalysis":
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

	// 转换为 ConsultMessage 格式
	const consultMessages: ConsultMessage[] = messages.map((msg: any) => ({
		role: msg.sender === "user" ? "user" : "system",
		content: msg.content || "",
		fromVoice: false,
		voiceUrl: undefined,
		voiceLength: undefined,
		deepThink: msg.deepThink,
		deepThinkStartTime: msg.thinkingTime ? Date.now() - msg.thinkingTime * 1000 : undefined,
		deepThinkEndTime: msg.thinkingTime ? Date.now() : undefined,
		haveRecommendLawyer: msg.haveRecommendLawyer,
		recommendedLawyerIds: msg.recommendedLawyerIds || [],
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
 * 导出类型供外部使用
 */
export type { HistoryBizType, HistorySessionItem };
