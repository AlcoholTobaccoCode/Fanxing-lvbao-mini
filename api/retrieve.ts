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
	/** 地区筛选 (多选，空格分隔) */
	area_facet?: string;
	/** 效力级别筛选 (多选，空格分隔) */
	xls?: string;
	/** 时效性筛选 (单选) */
	lawstatexls_facet?: string;
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
	// 筛选参数
	if (data.area_facet) {
		params.push(`area_facet=${encodeURIComponent(data.area_facet)}`);
	}
	if (data.xls) {
		params.push(`xls=${encodeURIComponent(data.xls)}`);
	}
	if (data.lawstatexls_facet) {
		params.push(`lawstatexls_facet=${encodeURIComponent(data.lawstatexls_facet)}`);
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

// ============ 法睿 (专业版) 案例检索 ============

/**
 * 法睿案例检索请求参数
 */
export interface FaruiCaseSearchRequest {
	/** 检索内容 */
	content: string;
	/** 页码，默认 1 */
	pageNumber?: number;
	/** 每页数量，默认 10 */
	pageSize?: number;
}

/**
 * 审理法院信息
 */
export interface FaruiTrialCourt {
	country?: string;
	province?: string;
	city?: string;
	district?: string;
	county?: string;
	name?: string;
	commonLevel?: string;
	specialLevel?: string;
}

/**
 * 法睿案例详情
 */
export interface FaruiCaseDomain {
	caseId: string;
	caseNo: string;
	caseTitle: string;
	caseSummary?: string;
	caseType?: string;
	caseCause?: string;
	documentType?: string;
	trialLevel?: string;
	trialDate?: string;
	trialCourt?: FaruiTrialCourt;
	verdict?: string;
	courtThink?: string;
	courtFindOut?: string;
	appliedLaws?: string;
	sourceContent?: string;
	openCaseCause?: string;
	closeCaseCause?: string;
	caseFeature?: string;
	disputeFocus?: string;
	keyfacts?: string;
	litigants?: string;
	dataFrom?: string;
}

/**
 * 法睿案例检索结果项
 */
export interface FaruiCaseResultItem {
	mode?: string;
	similarity: string;
	caseDomain: FaruiCaseDomain;
}

/**
 * 法睿案例检索响应
 */
export interface FaruiCaseSearchResponse {
	queryKeywords?: string[];
	query?: string;
	caseResult: FaruiCaseResultItem[];
	caseLevel?: string;
	pageSize: number;
	currentPage: number;
	totalCount: number;
}

/**
 * 法睿案例检索
 * POST /law/queryCase
 */
export const QueryFaruiCase = (data: FaruiCaseSearchRequest): Promise<ApiResponse<FaruiCaseSearchResponse>> => {
	return request({
		url: "/law/queryCase",
		method: "POST",
		data: {
			content: data.content,
			pageNumber: data.pageNumber || 1,
			pageSize: data.pageSize || 10
		}
	}) as Promise<ApiResponse<FaruiCaseSearchResponse>>;
};
