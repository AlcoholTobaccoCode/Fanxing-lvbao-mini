/**
 * 环信 IM 与本地数据合并工具函数
 * 用于合并环信消息/会话与本地存储的消息/会话，实现去重和排序
 */

import type { EasemobConversationItem } from "./index";
import type { ChatHistoryMessage, ChatSessionItem } from "@/api/chat-im";

//#region 类型定义

/** 统一消息格式 */
export interface UnifiedMessage {
	id: string;
	type: string;
	chatType: string;
	from: string;
	to: string;
	time: number;
	msg?: string;
	url?: string;
	filename?: string;
	file_length?: number;
	width?: number;
	height?: number;
	length?: number;
	ext?: Record<string, any>;
	body?: any;
	/** 数据来源: easemob | local */
	_source?: "easemob" | "local";
}

/** 统一会话格式 */
export interface UnifiedConversation {
	conversationId: string;
	conversationType: string;
	isPinned: boolean;
	pinnedTime: number;
	unReadCount: number;
	lastMessage: any;
	/** 数据来源: easemob | local */
	_source?: "easemob" | "local";
}

export type SortOrder = "asc" | "desc";

//#endregion

//#region 辅助函数

/**
 * 从消息对象中提取消息 ID
 */
export const extractMessageId = (msg: any): string => {
	if (!msg) return "";
	return String(msg.id || msg.msgId || msg.message_id || "");
};

/**
 * 从消息对象中提取时间戳
 */
export const extractMessageTime = (msg: any): number => {
	if (!msg) return 0;
	const raw = msg.time || msg.msgTime || msg.serverTime || (msg.body && msg.body.time) || 0;
	const num = typeof raw === "number" ? raw : Number(raw);
	return Number.isNaN(num) ? 0 : num;
};

/**
 * 将环信消息格式化为统一格式
 */
export const normalizeEasemobMessage = (msg: any): UnifiedMessage => {
	const body = msg.body || {};
	return {
		id: extractMessageId(msg),
		type: msg.type || body.type || "txt",
		chatType: msg.chatType || "singleChat",
		from: msg.from || "",
		to: msg.to || "",
		time: extractMessageTime(msg),
		msg: msg.msg || body.msg,
		url: msg.url || body.url,
		filename: msg.filename || body.filename,
		file_length: msg.file_length || body.file_length,
		width: msg.width || body.width,
		height: msg.height || body.height,
		length: msg.length || body.length,
		ext: msg.ext || body.ext,
		body: msg.body,
		_source: "easemob"
	};
};

/**
 * 将本地消息格式化为统一格式
 */
export const normalizeLocalMessage = (msg: ChatHistoryMessage): UnifiedMessage => {
	return {
		id: msg.id || "",
		type: msg.type || "txt",
		chatType: msg.chatType || "singleChat",
		from: msg.from || "",
		to: msg.to || "",
		time: msg.time || 0,
		msg: msg.msg,
		url: msg.url,
		filename: msg.filename,
		file_length: msg.file_length,
		width: msg.width,
		height: msg.height,
		ext: msg.ext,
		_source: "local"
	};
};

/**
 * 将环信会话格式化为统一格式
 */
export const normalizeEasemobConversation = (conv: EasemobConversationItem): UnifiedConversation => {
	return {
		conversationId: conv.conversationId || "",
		conversationType: conv.conversationType || "singleChat",
		isPinned: conv.isPinned || false,
		pinnedTime: conv.pinnedTime || 0,
		unReadCount: conv.unReadCount || 0,
		lastMessage: conv.lastMessage || null,
		_source: "easemob"
	};
};

/**
 * 将本地会话格式化为统一格式
 * @param conv 本地会话
 * @param currentUserId 当前用户ID，用于从 "userId1_userId2" 格式中提取对端用户ID
 */
export const normalizeLocalConversation = (
	conv: ChatSessionItem,
	currentUserId?: string
): UnifiedConversation => {
	// 本地 conversationId 格式为 "userId1_userId2"，需要提取对端用户ID
	let normalizedConvId = conv.conversationId || "";
	if (normalizedConvId.includes("_") && currentUserId) {
		const parts = normalizedConvId.split("_");
		// 找出不是当前用户的那个ID作为 conversationId
		normalizedConvId = parts.find((p) => p !== currentUserId) || parts[0] || normalizedConvId;
	}

	return {
		conversationId: normalizedConvId,
		conversationType: conv.conversationType || "singleChat",
		isPinned: conv.isPinned || false,
		pinnedTime: conv.pinnedTime || 0,
		unReadCount: conv.unReadCount || 0,
		lastMessage: conv.lastMessage || null,
		_source: "local"
	};
};

/**
 * 获取会话最后消息时间
 */
const getConversationLastTime = (conv: UnifiedConversation): number => {
	const m = conv.lastMessage;
	if (!m) return 0;
	const raw = m.time || m.serverTime || 0;
	const num = typeof raw === "number" ? raw : Number(raw);
	return Number.isNaN(num) ? 0 : num;
};

//#endregion

//#region 核心合并函数

/**
 * 合并消息列表并去重
 * @param easemobMessages 环信消息列表
 * @param localMessages 本地消息列表
 * @param sortOrder 排序方式: asc=时间正序(旧→新), desc=时间倒序(新→旧)
 * @returns 合并去重后的消息列表
 */
export const mergeMessages = (
	easemobMessages: any[],
	localMessages: ChatHistoryMessage[],
	sortOrder: SortOrder = "asc"
): UnifiedMessage[] => {
	const messageMap = new Map<string, UnifiedMessage>();

	// 先添加本地消息
	for (const msg of localMessages) {
		const normalized = normalizeLocalMessage(msg);
		const id = normalized.id;
		if (id) {
			messageMap.set(id, normalized);
		}
	}

	// 再添加环信消息（覆盖同 ID 的本地消息，环信优先级更高）
	for (const msg of easemobMessages) {
		const normalized = normalizeEasemobMessage(msg);
		const id = normalized.id;
		if (id) {
			messageMap.set(id, normalized);
		}
	}

	// 转为数组并排序
	const result = Array.from(messageMap.values());
	result.sort((a, b) => {
		const diff = a.time - b.time;
		return sortOrder === "asc" ? diff : -diff;
	});

	return result;
};

/**
 * 合并会话列表并去重
 * @param easemobConversations 环信会话列表
 * @param localConversations 本地会话列表
 * @param currentUserId 当前用户ID，用于处理本地会话ID格式差异
 * @returns 合并去重后的会话列表（按置顶+最后消息时间排序）
 */
export const mergeConversations = (
	easemobConversations: EasemobConversationItem[],
	localConversations: ChatSessionItem[],
	currentUserId?: string
): UnifiedConversation[] => {
	const convMap = new Map<string, UnifiedConversation>();

	// 先添加本地会话
	for (const conv of localConversations) {
		const normalized = normalizeLocalConversation(conv, currentUserId);
		const id = normalized.conversationId;
		if (id) {
			convMap.set(id, normalized);
		}
	}

	// 再添加环信会话（覆盖同 ID 的本地会话，环信优先级更高）
	for (const conv of easemobConversations) {
		const normalized = normalizeEasemobConversation(conv);
		const id = normalized.conversationId;
		if (id) {
			convMap.set(id, normalized);
		}
	}

	// 转为数组并排序：置顶优先，然后按最后消息时间倒序
	const result = Array.from(convMap.values());
	result.sort((a, b) => {
		// 置顶优先
		if (a.isPinned && !b.isPinned) return -1;
		if (!a.isPinned && b.isPinned) return 1;
		// 同为置顶则按置顶时间倒序
		if (a.isPinned && b.isPinned) {
			return b.pinnedTime - a.pinnedTime;
		}
		// 非置顶按最后消息时间倒序
		return getConversationLastTime(b) - getConversationLastTime(a);
	});

	return result;
};

/**
 * 将新消息与现有列表去重合并
 * 用于上拉加载更多时，将新获取的消息与现有列表合并
 * @param existingMessages 现有消息列表
 * @param newMessages 新获取的消息列表
 * @param sortOrder 排序方式
 * @returns 合并去重后的消息列表
 */
export const mergeNewMessages = (
	existingMessages: UnifiedMessage[],
	newMessages: any[],
	sortOrder: SortOrder = "asc"
): UnifiedMessage[] => {
	const messageMap = new Map<string, UnifiedMessage>();

	// 先添加现有消息
	for (const msg of existingMessages) {
		const id = msg.id;
		if (id) {
			messageMap.set(id, msg);
		}
	}

	// 再添加新消息
	for (const msg of newMessages) {
		const normalized = normalizeEasemobMessage(msg);
		const id = normalized.id;
		if (id) {
			messageMap.set(id, normalized);
		}
	}

	// 转为数组并排序
	const result = Array.from(messageMap.values());
	result.sort((a, b) => {
		const diff = a.time - b.time;
		return sortOrder === "asc" ? diff : -diff;
	});

	return result;
};

//#endregion
