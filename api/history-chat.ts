import { request } from "@/cool";
import type { ApiResponse } from "./types";

//#region 保存聊天记录

export interface SaveMessagesPayload {
	user_id: number;
	session_id: string;
	message: Record<string, any>;
}

export type EmptyObject = Record<string, never>;

export const SaveMessages = (data: SaveMessagesPayload): Promise<ApiResponse<EmptyObject>> => {
	return request({
		url: "/user/saveMessages",
		method: "POST",
		data
	}) as Promise<ApiResponse<EmptyObject>>;
};

//#endregion

//#region 读取聊天记录

export interface LoadMessagesPayload {
	user_id: number;
	session_id: string;
}

export type LoadMessagesResponse = Record<string, any>;

export const LoadMessages = (
	data: LoadMessagesPayload
): Promise<ApiResponse<LoadMessagesResponse>> => {
	return request({
		url: "/user/loadMessages",
		method: "POST",
		data
	}) as Promise<ApiResponse<LoadMessagesResponse>>;
};

//#endregion

//#region 删除聊天记录

export interface DeleteMessagePayload {
	user_id: number;
	session_id: string;
}

export const DeleteMessage = (data: DeleteMessagePayload): Promise<ApiResponse<EmptyObject>> => {
	return request({
		url: "/user/delMessage",
		method: "POST",
		data
	}) as Promise<ApiResponse<EmptyObject>>;
};

//#endregion

//#region 获取用户会话列表

export interface UserSessionItem {
	session_id: string;
	title: string;
	created_at: number;
}

export interface GetUserSessionsParams {
	user_id?: number;
}

export interface GetUserSessionsData {
	user_id: number;
	sessions: UserSessionItem[];
}

export const GetUserSessions = (
	data?: GetUserSessionsParams
): Promise<ApiResponse<GetUserSessionsData>> => {
	return request({
		url: "/user/sessions",
		method: "GET",
		data
	}) as Promise<ApiResponse<GetUserSessionsData>>;
};

//#endregion

//#region 修改会话标题

export interface UpdateSessionTitlePayload {
	session_id: string;
	title: string;
}

export const UpdateSessionTitle = (
	data: UpdateSessionTitlePayload
): Promise<ApiResponse<EmptyObject>> => {
	return request({
		url: "/user/session_title",
		method: "POST",
		data
	}) as Promise<ApiResponse<EmptyObject>>;
};

//#endregion
