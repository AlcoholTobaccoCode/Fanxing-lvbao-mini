import { request } from "@/cool";

/**
 * 律师列表查询参数
 */
export interface LawyerListParams {
	page: number; // 页码，从 1 开始
	page_size: number; // 每页条数（1~50）
	sort_by?: "rating" | "case_count" | "practice_years" | "updated_at"; // 排序字段
	order?: "asc" | "desc"; // 排序方向
	lawyer_license_id?: string; // 律师执业证号（精确）
	phone_number?: string; // 联系电话（精确）
	name?: string; // 姓名（模糊匹配）
	keyword?: string; // 关键词（姓名/律所/擅长领域）
	law_firm_name?: string; // 律所名称（模糊）
	addr?: string; // 地区/地址关键词（模糊）
	grade_name?: string; // 职级/头衔
	expertise?: string; // 擅长领域关键词
	direction_id?: number; // 方向 ID（匹配 d1/d2/d3）
	certification_direction?: number; // 认证方向 ID
	min_years?: number; // 最少从业年限
	max_years?: number; // 最多从业年限
	min_score?: number; // 最低评分
	max_score?: number; // 最高评分
	min_rating_count?: number; // 最少评分人数
	max_rating_count?: number; // 最多评分人数
}

/**
 * 律师信息
 */
export interface LawyerInfo {
	user_id: number;
	name: string;
	law_firm_name: string;
	addr: string;
	grade_name: string;
	expertise: string;
	intro: string;
	license_no: string;
	lawyer_license_id: string;
	avatar_url: string | null;
	rating: number;
	rating_count: number;
	case_count: number;
	practice_years: number;
	updated_at: string;
}

/**
 * 律师列表响应
 */
export interface LawyerListResponse {
	total: number;
	page: number;
	page_size: number;
	items: LawyerInfo[];
}

/**
 * 获取律师列表
 */
export const GetLawyerList = (data: LawyerListParams): Promise<LawyerListResponse> => {
	return request({
		url: "/lawyer/search",
		method: "POST",
		data
	});
};
