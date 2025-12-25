/**
 * 检索模块 API 定义
 * - 法规查询
 * - 案例检索
 */
import { request } from "@/cool";
import type { ApiResponse } from "./types";

/**
 * 检索请求参数
 */
export interface RetrieveRequest {
	/** 检索内容 */
	content: string;
	/** 页码 */
	pageNumber?: number;
	/** 页大小 */
	pageSize?: number;
}

/**
 * 法规查询
 * POST /law/queryLaw
 */
export const QueryLaw = (data: RetrieveRequest): Promise<ApiResponse<any>> => {
	return request({
		url: "/law/queryLaw",
		method: "POST",
		data
	}) as Promise<ApiResponse<any>>;
};

/**
 * 案例检索
 * POST /law/queryCase
 */
export const QueryCase = (data: RetrieveRequest): Promise<ApiResponse<any>> => {
	return request({
		url: "/law/queryCase",
		method: "POST",
		data
	}) as Promise<ApiResponse<any>>;
};

// ============ 律之星 (专业版) ============

/**
 * 律之星法规检索请求参数
 */
export interface LzxLawSearchRequest {
	/** 返回条数，默认 10，最大 100 */
	rows?: number;
	/** 语义描述，用于检索法规 */
	vector: string;
}

/**
 * 律之星法规检索结果项
 */
export interface LzxLawResultItem {
	lawId: string;
	lawName: string;
	content: string;
	rawnumber: string;
	issuingOrgan: string;
	timeliness: string;
	score: number;
	filenum?: string;
	xls?: string;
	topName?: string;
	releaseYearMonthDate?: string;
	implementYearMonthDate?: string;
	hisgroup?: Array<{
		htitle: string;
		happdate: string;
		hlawstate: string;
		lawId: string;
	}>;
}

/**
 * 律之星法规检索
 * GET /law/search-law
 */
export const QueryLzxLaw = (data: LzxLawSearchRequest): Promise<ApiResponse<{ result: LzxLawResultItem[] }>> => {
	const rows = typeof data.rows === "number" && data.rows > 0 ? data.rows : 10;
	const vector = data.vector || "";

	// 手动拼接查询字符串（小程序不支持 URLSearchParams）
	const params: string[] = [`rows=${rows}`];
	if (vector) {
		params.push(`vector=${encodeURIComponent(vector)}`);
	}

	return request({
		url: `/law/search-law?${params.join("&")}`,
		method: "GET"
	}) as Promise<ApiResponse<{ result: LzxLawResultItem[] }>>;
};

// ============ 法宝 (通用版) SSE 类型定义 ============

/**
 * 法宝法规检索消息格式
 */
export interface FabaoLawMessage {
	role: "user" | "system";
	content: string;
}

/**
 * 法宝法规检索请求参数
 * POST /law/queryLaw1 (SSE)
 */
export interface FabaoLawRequest {
	messages: FabaoLawMessage[];
}

/**
 * 法宝 SSE Stage 类型
 */
export type FabaoSseStage = "info" | "mcp_call" | "mcp_result" | "qwen" | "qwen_delta" | "final";

/**
 * 法宝 SSE 响应数据 (根据 stage 不同结构不同)
 */
export interface FabaoSsePayload {
	stage: FabaoSseStage;
	message?: string;
	tool?: string;
	args?: { text?: string };
	result?: Array<{ title: string; article: string; url: string }>;
	query?: string;
	case_count?: number;
	cases?: Array<{
		title: string;
		content: string;
		url: string;
		doc_type: string;
		case_type: string;
		court_name: string;
		decision_date: string;
		cause_of_action: string;
	}>;
	delta?: string;
	content?: string;
	event?: string;
}
