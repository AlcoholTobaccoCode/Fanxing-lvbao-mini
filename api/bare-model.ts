import { request } from "@/cool";
import type { ApiResponse } from "./types";

//#region 类型定义

/** 消息角色 */
export type BareModelRole = "user" | "system" | "assistant";

/** 消息结构 */
export interface BareModelMessage {
	role: BareModelRole;
	content: string;
}

/** 请求参数 */
export interface BareModelPayload {
	/** 模型名称（阿里云通义） */
	model: string;
	/** 消息列表（可选，与 prompt 至少一个） */
	messages?: BareModelMessage[];
	/** 单条提示词（可选，会追加为一条 user 消息） */
	prompt?: string;
	/** 是否开启思考，默认 false */
	enable_thinking?: boolean;
	/** 是否流式响应，默认 true */
	stream?: boolean;
}

/** SSE 阶段类型 */
export type BareModelSseStage = "answer" | "thinking" | "end";

/** SSE 响应数据 */
export interface BareModelSsePayload {
	stage: BareModelSseStage;
	/** 增量文本内容 */
	delta?: string;
}

/** 非流式响应数据 */
export interface BareModelResponse {
	content: string;
}

//#endregion

//#region API 函数

/** 裸模调用（非流式） */
export const callBareModel = (data: BareModelPayload): Promise<ApiResponse<BareModelResponse>> => {
	return request({
		url: "/utils/bare_model",
		method: "POST",
		data: { ...data, stream: false }
	}) as Promise<ApiResponse<BareModelResponse>>;
};
//#endregion
