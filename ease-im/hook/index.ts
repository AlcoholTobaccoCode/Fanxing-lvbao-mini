import { ref } from "vue";
import { GetUsernames, type GetUsernamesPayload, type GetUsernamesResponse } from "@/api/chat-im";
import type { EasemobConversationItem } from "@/utils/easemob";

// 统一的用户名获取 hook，封装接口调用与缓存
export const useChatUsernames = () => {
	// 加载状态（外部可选用来控制骨架屏等）
	const isLoading = ref(false);
	// userId -> userName 映射缓存下载
	const usernameMap = ref<Record<string, string>>({});

	// 批量获取用户名，并合并到本地缓存
	const fetchUsernames = async (payload: GetUsernamesPayload) => {
		if (!payload?.userIds || payload.userIds.length === 0)
			return {
				userNames: [] as GetUsernamesResponse["userNames"]
			};
		isLoading.value = true;
		try {
			const res = await GetUsernames(payload);
			const names = (res?.userNames || []) as GetUsernamesResponse["userNames"];
			const nextMap: Record<string, string> = { ...usernameMap.value };
			payload.userIds.forEach((id, idx) => {
				const name = names[idx];
				if (name) {
					nextMap[String(id)] = String(name);
				}
			});
			usernameMap.value = nextMap;
			return { userNames: names };
		} finally {
			isLoading.value = false;
		}
	};

	const getTitle = (item: EasemobConversationItem) => {
		const m: any = (item as any).lastMessage;
		const extUser = m?.ext?.sendUserInfo;
		const nameFromMap = usernameMap.value[item.conversationId];
		const name = nameFromMap || extUser?.name || item.conversationId;
		return String(name || "");
	};

	return {
		isLoading,
		usernameMap,
		fetchUsernames,
		getTitle
	};
};

// 未读角标文案
export const formatUnread = (count?: number) => {
	if (!count || count <= 0) return "";
	if (count <= 99) return String(count);
	if (count <= 999) return "99+";
	return "...";
};
