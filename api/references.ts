/**
 * 法规/案例引用详情 API
 */
import { request } from "@/cool";
import type { ApiResponse } from "./types";

// ============ 类型定义 ============

/** 法规详情请求项 */
export interface LawDetailItem {
	lawId: string;
	lawItemId: string;
}

/** 法条沿革项 */
export interface LawHistoryItem {
	lawAbstract?: string;
	lawId: string;
	lawName: string;
	releaseYearMonthDate: string;
}

/** 法规详情响应 */
export interface LawDetailResponse {
	lawId: string;
	lawItemId: string;
	lawName: string;
	lawOrder: string;
	lawSourceContent: string;
	timeliness: string;
	releaseYearMonthDate: string;
	implementYearMonthDate?: string;
	historyLine: LawHistoryItem[];
	issuingNo?: string;
	issuingOrgan?: string;
	potencyLevel?: string;
}

/** 案例详情中的法院信息 */
export interface TrialCourt {
	name: string;
	city?: string;
	province?: string;
	commonLevel?: string;
}

/** 案例详情响应 */
export interface CaseDetailResponse {
	caseDomain: {
		caseNo: string;
		caseTitle: string;
		caseSummary: string;
		courtFindOut: string;
		courtThink: string;
		verdict: string;
		trialCourt: TrialCourt;
		trialDate: string;
		caseCause?: string;
		caseType?: string;
		trialLevel?: string;
	};
	caseLevel?: string;
}

/** 联网搜索项 */
export interface SearchItem {
	hostName?: string;
	hostLogo?: string;
	indexId?: number;
	time?: string;
	title?: string;
	body?: string;
	url?: string;
}

// ============ API 接口 ============

/**
 * 获取法规详情
 * @param lawDetailList 法规列表
 */
export const GetLawCardDetail = (
	lawDetailList: LawDetailItem[]
): Promise<ApiResponse<LawDetailResponse[]>> => {
	return request({
		url: "/farui/proxy/lawDetailList",
		method: "POST",
		data: { lawDetailList }
	}) as Promise<ApiResponse<LawDetailResponse[]>>;
};

/**
 * 获取案例详情
 * @param caseNoList 案号列表
 */
export const GetCaseCardDetail = (
	caseNoList: string[]
): Promise<ApiResponse<CaseDetailResponse[]>> => {
	return request({
		url: "/farui/proxy/caseDetailList",
		method: "POST",
		data: { caseNoList }
	}) as Promise<ApiResponse<CaseDetailResponse[]>>;
};
