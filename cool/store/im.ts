import { ref, computed } from "vue";
import type { EasemobConversationItem } from "@/utils/easemob";
import { getEasemobServerConversations } from "@/utils/easemob";
import { imBus, type OnTextMsgResult } from "@/utils/easemob/events";

/**
 * 环信 IM Store
 * 管理全局 IM 状态、未读消息数、会话列表等
 * https://doc.easemob.com/document/applet/conversation_list.html#%E6%8E%A5%E5%8F%A3%E9%99%90%E5%88%B6%E4%B8%8E%E6%9C%80%E4%BD%B3%E5%AE%9E%E8%B7%B5
 */
export class ImStore {
	/**
	 * 未读消息总数
	 */
	unReadCount = ref<number>(0);

	/**
	 * 会话列表（本地缓存）
	 */
	conversations = ref<EasemobConversationItem[]>([]);

	/**
	 * 是否正在加载
	 */
	isLoading = ref<boolean>(false);

	/**
	 * IM 是否已初始化
	 */
	isInitialized = ref<boolean>(false);

	constructor() {
		// 监听 IM 事件，通过回调数据更新本地缓存
		this.setupEventListeners();
	}

	/**
	 * 设置事件监听器
	 */
	private setupEventListeners() {
		// 监听收到新消息 - 直接用回调数据更新本地缓存
		imBus.on("im:onTextMessage", (msg: OnTextMsgResult) => {
			console.log("[IM Store] 收到新消息，更新本地缓存", msg);
			this.updateConversationByMessage(msg, true);
		});

		// 监听发送消息成功 - 更新本地缓存（未读数不变）
		imBus.on("im:onSendMsg", (res: any) => {
			console.log("[IM Store] 发送消息成功，更新本地缓存");
			const msg = res.message || res;
			if (msg) {
				this.updateConversationByMessage(msg, false);
			}
		});

		// 监听已读状态更新 - 直接减少本地缓存的未读数
		imBus.on("im:onReadStatusUpdated", (payload) => {
			console.log("[IM Store] 消息已读，更新本地缓存:", payload.peerId);
			this.updateConversationReadStatus(payload.peerId);
		});

		// 监听登录成功 - 仅此时调用一次接口获取初始数据
		imBus.on("im:onLogin", () => {
			console.log("[IM Store] 登录成功，初始化会话列表...");
			this.isInitialized.value = true;
			this.loadConversations();
		});
	}

	/**
	 * 加载会话列表（仅在登录时调用一次）
	 */
	async loadConversations() {
		if (this.isLoading.value) {
			console.log("[IM Store] 正在加载中，跳过本次请求");
			return;
		}

		try {
			this.isLoading.value = true;
			console.log("[IM Store] 开始加载会话列表...");

			const res = await getEasemobServerConversations({
				pageSize: 50,
				cursor: "",
				includeEmptyConversations: false
			});

			const conversations = (res?.data?.conversations || []) as EasemobConversationItem[];

			// 计算未读消息总数
			let totalUnread = 0;
			conversations.forEach((conv) => {
				totalUnread += conv.unReadCount || 0;
			});

			// 更新数据
			this.conversations.value = conversations;
			this.unReadCount.value = totalUnread;

			console.log(
				`[IM Store] 会话列表已加载: ${conversations.length} 个会话, 未读数: ${totalUnread}`
			);
		} catch (error) {
			console.error("[IM Store] 加载会话列表失败:", error);
		} finally {
			this.isLoading.value = false;
		}
	}

	/**
	 * 通过新消息更新会话列表（本地缓存）
	 * @param msg 消息对象
	 * @param isReceived 是否是接收的消息（true: 收到新消息，未读数+1；false: 发送的消息，未读数不变）
	 */
	private updateConversationByMessage(msg: OnTextMsgResult, isReceived: boolean) {
		// 确定会话 ID（收到的消息用 from，发送的消息用 to）
		const conversationId = isReceived ? msg.from : msg.to;
		const chatType = msg.chatType as "singleChat" | "groupChat";

		// 查找或创建会话
		const existingIndex = this.conversations.value.findIndex(
			(conv) => conv.conversationId === conversationId
		);

		if (existingIndex >= 0) {
			// 会话已存在，更新它
			const conv = this.conversations.value[existingIndex];
			const oldUnread = conv.unReadCount || 0;

			// 更新最新消息
			conv.lastMessage = msg as any;

			// 更新未读数（只有接收的消息才增加未读数）
			if (isReceived) {
				conv.unReadCount = oldUnread + 1;
				this.unReadCount.value += 1;
			}

			// 移到列表顶部
			this.conversations.value.splice(existingIndex, 1);
			this.conversations.value.unshift(conv);

			console.log(
				`[IM Store] 更新会话 ${conversationId}, 未读数: ${oldUnread} → ${conv.unReadCount}`
			);
		} else {
			// 会话不存在，创建新会话
			const newConv: EasemobConversationItem = {
				conversationId,
				conversationType: chatType,
				lastMessage: msg as any,
				unReadCount: isReceived ? 1 : 0
			};

			this.conversations.value.unshift(newConv);

			if (isReceived) {
				this.unReadCount.value += 1;
			}

			console.log(`[IM Store] 创建新会话 ${conversationId}, 未读数: ${newConv.unReadCount}`);
		}
	}

	/**
	 * 更新会话的已读状态（本地缓存）
	 * @param peerId 对方用户 ID
	 */
	private updateConversationReadStatus(peerId: string) {
		const conv = this.conversations.value.find((c) => c.conversationId === peerId);

		if (conv) {
			const oldUnread = conv.unReadCount || 0;

			// 减少总未读数
			this.unReadCount.value -= oldUnread;

			// 清空该会话的未读数
			conv.unReadCount = 0;

			console.log(`[IM Store] 会话 ${peerId} 已读, 未读数: ${oldUnread} → 0`);
		} else {
			console.log(`[IM Store] 未找到会话 ${peerId}`);
		}
	}

	/**
	 * 格式化未读消息数显示
	 * @param count 未读消息数
	 * @returns 格式化后的字符串，如 "99+" 或具体数字
	 */
	formatUnreadCount(count: number): string {
		if (count <= 0) return "";
		if (count > 99) return "99+";
		return String(count);
	}

	/**
	 * 手动刷新会话列表（用于用户下拉刷新等场景）
	 */
	async manualRefresh() {
		console.log("[IM Store] 用户手动刷新会话列表...");
		await this.loadConversations();
	}

	/**
	 * 清空所有数据（退出登录时调用）
	 */
	clear() {
		this.unReadCount.value = 0;
		this.conversations.value = [];
		this.isInitialized.value = false;
		this.isLoading.value = false;

		console.log("[IM Store] 数据已清空");
	}
}

/**
 * 全局单例 IM Store
 */
export const imStore = new ImStore();

/**
 * 未读消息总数（响应式，可直接在组件中使用）
 */
export const unReadCount = computed(() => imStore.unReadCount.value);

/**
 * 会话列表（响应式，可直接在组件中使用）
 */
export const conversations = computed(() => imStore.conversations.value);
