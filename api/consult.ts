/* 
咨询模块 api 定义
*/
import { request } from "@/cool";
import type { ApiResponse } from "./types";

// 律师推荐接口 —— 排序版

export interface RecommendLawyerItem {
	user_id: number;
	name: string;
	law_firm_name: string;
	addr: string;
	expertise: string;
	grade_name: string;
	license_no: string;
	lawyer_license_id: string;
	intro: string;
	practice_years: number;
	case_count: number;
	rating: number;
	online?: boolean;
	avatar_url: string;
}

export interface RecommendLawyerParams {
	session_id: string;
	sort_by?: "rating" | "practice_years" | "case_count";
	order?: "asc" | "desc";
	limit?: number;
}

export type RecommendLawyerResponse = RecommendLawyerItem[];

export const RecommendLawyers = (
	data: RecommendLawyerParams
): Promise<ApiResponse<RecommendLawyerResponse>> => {
	return request({
		url: "/lawyer/recommend",
		method: "POST",
		data
	}) as Promise<ApiResponse<RecommendLawyerResponse>>;
};
