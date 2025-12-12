import { request } from "@/cool";
import { type ApiResponse } from "./types";

//#region 存储单个聊天记录到本地
export interface SaveChatMessagePayload {
	message_id: string;
	senderId: string;
	receiverId: string;
	senderRole: string;
	msgType: string;
	content: string;
}

export interface SaveChatMessageResponse {
	msgId: string;
	sessionId: string;
	serverTimestamp: number;
}

export const SaveChatMessage = (
	data: SaveChatMessagePayload
): Promise<ApiResponse<SaveChatMessageResponse>> => {
	return request({
		url: "/chat/messages",
		method: "POST",
		data
	}) as Promise<ApiResponse<SaveChatMessageResponse>>;
};

//#endregion

//#region 从本地读取单个聊天记录详情

export interface GetChatHistoryParams {
	peerId: string;
	fromTimestamp: number;
	toTimestamp: number;
	page?: number;
	pageSize?: number;
}

export interface ChatHistoryMessage {
	id: string;
	type: string; // txt / img / file / audio / video / custom
	chatType: string; // singleChat / groupChat
	from: string;
	to: string;
	time: number;
	ext?: Record<string, any>;
	// 文本消息
	msg?: string;
	// 媒体消息
	url?: string;
	filename?: string;
	file_length?: number;
	width?: number;
	height?: number;
}

export interface GetChatHistoryResponse {
	sessionId: string;
	page: number;
	pageSize: number;
	hasMore: boolean;
	messages: ChatHistoryMessage[];
}

export const getChatHistory = (
	params: GetChatHistoryParams
): Promise<ApiResponse<GetChatHistoryResponse>> => {
	return request({
		url: "/chat/history",
		method: "GET",
		params
	}) as Promise<ApiResponse<GetChatHistoryResponse>>;
};

//#endregion

//#region 修改消息的阅读状态

export interface UpdateReadStatusPayload {
	peerId: string;
	messageIds?: string[];
	beforeTimestamp?: number;
}

export interface UpdateReadStatusResponse {
	sessionId: string;
	updated: number;
}

export const updateReadStatus = (
	data: UpdateReadStatusPayload
): Promise<ApiResponse<UpdateReadStatusResponse>> => {
	return request({
		url: "/chat/readStatus",
		method: "POST",
		data
	}) as Promise<ApiResponse<UpdateReadStatusResponse>>;
};

//#endregion

//#region 获取用户名列表

export interface GetUsernamesPayload {
	userIds: number[];
}

export interface GetUsernamesResponse {
	userNames: (string | null)[];
}

export const getUsernames = (
	data: GetUsernamesPayload
): Promise<ApiResponse<GetUsernamesResponse>> => {
	return request({
		url: "/chat/usernames",
		method: "POST",
		data
	}) as Promise<ApiResponse<GetUsernamesResponse>>;
};

//#endregion

//#region 获取用户 session 列表

export interface ChatSessionLastMessage {
	id: string;
	type: string;
	chatType: string;
	from: string;
	to: string;
	time: number;
	ext?: Record<string, any>;
	msg?: string;
}

export interface ChatSessionItem {
	conversationId: string;
	conversationType: string; // singleChat / groupChat
	isPinned: boolean;
	pinnedTime: number;
	unReadCount: number;
	lastMessage: ChatSessionLastMessage;
}

export interface GetChatSessionsResponse {
	conversations: ChatSessionItem[];
}

export const getChatSessions = (): Promise<ApiResponse<GetChatSessionsResponse>> => {
	return request({
		url: "/chat/sessions",
		method: "GET"
	}) as Promise<ApiResponse<GetChatSessionsResponse>>;
};

//#endregion
