import { computed, onMounted, ref } from "vue";
import { useUi } from "@/uni_modules/cool-ui";
import { useStore } from "@/cool";
import {
	DeleteMessage,
	GetUserSessions,
	type GetUserSessionsData,
	type UserSessionItem,
	UpdateSessionTitle
} from "@/api/history-chat";

// 业务类型 & 标签元信息
export type HistoryBizType =
	| "consult" // 法律咨询
	| "retrieve" // 案例检索（旧版统一检索 + 案例）
	| "document" // 法规查询（旧版文档）
	| "complaint" // 起诉状
	| "defense" // 答辩状
	| "contract_generate" // 合同生成
	| "contract_review"; // 合同审查

export interface HistoryBizMeta {
	bizType: HistoryBizType;
	tagLabel: string;
	tagType: "blue" | "green" | "geekblue" | "orange" | "cyan" | "red" | "purple";
}

/**
 * 根据 sessionId 前缀推断业务类型
 * 只识别新版前缀，旧版数据返回 null 会被过滤
 */
export const getBizMetaBySessionId = (sessionId: string): HistoryBizMeta | null => {
	// 法律咨询
	if (sessionId.startsWith("ai_consult_")) {
		return {
			bizType: "consult",
			tagLabel: "咨询",
			tagType: "green"
		};
	}

	// 法规查询
	if (sessionId.startsWith("ai_retrieve_law_")) {
		return {
			bizType: "document",
			tagLabel: "法规",
			tagType: "cyan"
		};
	}

	// 案例检索
	if (sessionId.startsWith("ai_retrieve_case_")) {
		return {
			bizType: "retrieve",
			tagLabel: "案例",
			tagType: "orange"
		};
	}

	// 起诉状
	if (sessionId.startsWith("ai_complaint_")) {
		return {
			bizType: "complaint",
			tagLabel: "起诉状",
			tagType: "red"
		};
	}

	// 答辩状
	if (sessionId.startsWith("ai_defense_")) {
		return {
			bizType: "defense",
			tagLabel: "答辩状",
			tagType: "purple"
		};
	}

	// 合同审查
	if (sessionId.startsWith("ai_contract_review_")) {
		return {
			bizType: "contract_review",
			tagLabel: "合同审查",
			tagType: "geekblue"
		};
	}

	// 合同生成
	if (sessionId.startsWith("ai_contract_generate_")) {
		return {
			bizType: "contract_generate",
			tagLabel: "合同生成",
			tagType: "blue"
		};
	}

	// 未识别的前缀返回 null（会被过滤）
	return null;
};

export interface HistorySessionItem extends UserSessionItem, HistoryBizMeta {}

export interface HistoryGroupItem {
	label: string;
	items: HistorySessionItem[];
}

export function useHistorySessions() {
	const ui = useUi();
	const { user } = useStore();

	const isEditMode = ref<boolean>(false);
	const loading = ref(false);

	const userId = computed(() => user.info.value?.id ?? null);

	const aiSessions = ref<HistorySessionItem[]>([]);

	const sortedSessions = computed(() => {
		const list = aiSessions.value.slice();
		list.sort((a, b) => b.created_at - a.created_at);
		return list;
	});

	const getDayLabel = (timestamp: number): string => {
		const now = Date.now();
		const diff = now - timestamp;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return "刚刚";
		if (minutes < 60) return `${minutes}分钟前`;
		if (hours < 24) return `${hours}小时前`;
		if (days === 0) return "今天";
		if (days === 1) return "昨天";
		if (days < 7) return `${days}天前`;
		if (days < 30) return `${Math.floor(days / 7)}周前`;
		return `${Math.floor(days / 30)}月前`;
	};

	const groupedSessions = computed<HistoryGroupItem[]>(() => {
		const result: HistoryGroupItem[] = [];
		let currentLabel = "";
		let currentItems: HistorySessionItem[] = [];

		for (const item of sortedSessions.value) {
			const label = getDayLabel(item.created_at);
			if (!currentLabel) {
				currentLabel = label;
			}
			if (label !== currentLabel) {
				if (currentItems.length) {
					result.push({ label: currentLabel, items: currentItems });
				}
				currentLabel = label;
				currentItems = [];
			}
			currentItems.push(item);
		}

		if (currentItems.length) {
			result.push({ label: currentLabel, items: currentItems });
		}

		return result;
	});

	const formatTime = (ts: number): string => {
		const d = new Date(ts);
		const h = `${d.getHours()}`.padStart(2, "0");
		const m = `${d.getMinutes()}`.padStart(2, "0");
		return `${h}:${m}`;
	};

	const fetchSessions = async () => {
		if (!userId.value) {
			aiSessions.value = [];
			return;
		}

		try {
			loading.value = true;
			const res = (await GetUserSessions({
				user_id: userId.value
			})) as GetUserSessionsData | any;
			const data =
				(res as GetUserSessionsData)?.sessions ?? (res as any)?.data?.sessions ?? [];

			// 过滤并转换会话数据
			// 1. 过滤掉律师对话
			// 2. 过滤掉无法识别的旧版数据（getBizMetaBySessionId 返回 null）
			const validSessions: HistorySessionItem[] = [];
			for (const s of data as UserSessionItem[]) {
				if (s.session_id.startsWith("lawyer-session_")) continue;
				const meta = getBizMetaBySessionId(s.session_id);
				if (!meta) continue; // 过滤旧版数据
				validSessions.push({ ...s, ...meta });
			}

			aiSessions.value = validSessions;
		} catch (err) {
			console.error("[history] 获取会话列表失败", err);
			ui.showToast({ message: "获取历史记录失败，请稍后重试" });
		} finally {
			loading.value = false;
		}
	};

	onMounted(() => {
		fetchSessions();
	});

	const historyClearAll = () => {
		if (!userId.value || !aiSessions.value.length) {
			return;
		}

		ui.showConfirm({
			title: "清空历史记录",
			message: "确定要清空所有历史对话吗？此操作不可恢复。",
			confirmText: "清空",
			cancelText: "取消",
			callback(action: string) {
				if (action !== "confirm") {
					return;
				}

				(async () => {
					try {
						loading.value = true;
						await Promise.all(
							aiSessions.value.map((item) =>
								DeleteMessage({
									user_id: userId.value as number,
									session_id: item.session_id
								})
							)
						);
						aiSessions.value = [];
						ui.showToast({ message: "已清空历史记录" });
					} catch (err) {
						console.error("[history] 清空历史记录失败", err);
						ui.showToast({ message: "清空失败，请稍后重试" });
					} finally {
						loading.value = false;
						isEditMode.value = false;
					}
				})();
			}
		});
	};

	const handleItemEdit = (item: UserSessionItem) => {
		if (!userId.value) {
			ui.showToast({ message: "请先登录后再操作" });
			return;
		}

		uni.showModal({
			title: "重命名对话",
			editable: true,
			content: item.title,
			success: async (res) => {
				const newTitle: string = (res as any).content ?? item.title;
				if (!res.confirm) return;
				const trimmed = newTitle.trim();
				if (!trimmed) return;

				try {
					await UpdateSessionTitle({
						session_id: item.session_id,
						title: trimmed
					});
					aiSessions.value = aiSessions.value.map((s) =>
						s.session_id === item.session_id ? { ...s, title: trimmed } : s
					);
					ui.showToast({ message: "重命名成功" });
				} catch (err) {
					console.error("[history] 重命名会话失败", err);
					ui.showToast({ message: "重命名失败，请稍后重试" });
				}
			}
		});
	};

	const handleItemDel = (item: UserSessionItem) => {
		if (!userId.value) {
			ui.showToast({ message: "请先登录后再操作" });
			return;
		}

		ui.showConfirm({
			title: "删除确认",
			message: "确定要删除该条历史对话吗？此操作不可恢复。",
			confirmText: "删除",
			cancelText: "取消",
			callback(action: string) {
				if (action !== "confirm") {
					return;
				}

				(async () => {
					try {
						await DeleteMessage({
							user_id: userId.value as number,
							session_id: item.session_id
						});
						aiSessions.value = aiSessions.value.filter(
							(s) => s.session_id !== item.session_id
						);
						ui.showToast({ message: "已删除" });
					} catch (err) {
						console.error("[history] 删除会话失败", err);
						ui.showToast({ message: "删除失败，请稍后重试" });
					}
				})();
			}
		});
	};

	return {
		isEditMode,
		loading,
		userId,
		groupedSessions,
		formatTime,
		refreshSessions: fetchSessions,
		setEditMode: (val: boolean) => {
			isEditMode.value = val;
		},
		historyClearAll,
		handleItemEdit,
		handleItemDel
	};
}
