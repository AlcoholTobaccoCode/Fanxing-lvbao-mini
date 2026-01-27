import { ref } from "vue";
import { GetUserProfiles, type GetUserProfilesPayload, type UserProfiles } from "@/api/chat-im";
import type { EasemobConversationItem } from "@/utils/easemob";

// 统一的用户名获取 hook，封装接口调用与缓存
export const useChatUsernames = () => {
	// 加载状态
	const isLoading = ref(false);

	// 批量获取用户名，并合并到本地缓存
	const fetchUsernames = async (payload: GetUserProfilesPayload) => {
		if (!payload?.userIds || payload.userIds.length === 0)
			return {
				users: [] as UserProfiles[]
			};
		isLoading.value = true;
		try {
			const res = await GetUserProfiles(payload);
			const users = res?.users || [];
			return { users };
		} finally {
			isLoading.value = false;
		}
	};

	const getTitle = (item: EasemobConversationItem) => {
		const m: any = (item as any).lastMessage;
		const extUser = m?.ext?.sendUserInfo;
		const name = extUser?.lawyerName || extUser?.name || item.conversationId;
		return String(name || "");
	};

	const getAvatarUrl = (item: EasemobConversationItem) => {
		const m: any = (item as any).lastMessage;
		const extUser = m?.ext?.sendUserInfo;
		return String(extUser.avatarUrl || "");
	};

	return {
		isLoading,
		fetchUsernames,
		getTitle,
		getAvatarUrl
	};
};

// 未读角标文案
export const formatUnread = (count?: number) => {
	if (!count || count <= 0) return "";
	if (count <= 99) return String(count);
	if (count <= 999) return "99+";
	return "...";
};
