import { request } from "@/cool";
import { type ApiResponse } from "./types";

//#region 类型定义

/**
 * 对象类型枚举
 * 1: 文件
 * 2: 图片
 * 3: 笔记
 * 4: 引用
 */
export type KnowledgeObjectType = 1 | 2 | 3 | 4;

/**
 * 知识库对象基础信息
 */
export interface KnowledgeObject {
	id: number;
	userId: number;
	type: KnowledgeObjectType;
	title: string;
	description: string | null;
	ossBucket: string | null;
	ossKey: string | null;
	mimeType: string | null;
	sizeBytes: number | null;
	sha256: string | null;
	textContent: string | null;
	oss_url?: string;
	isDeleted: boolean;
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * 创建文件或对象的请求参数
 */
export interface CreateKnowledgePayload {
	type: KnowledgeObjectType;
	title: string;
	description?: string;
	ossBucket?: string;
	ossKey?: string;
	mimeType?: string;
	sizeBytes?: number;
	sha256?: string;
	textContent: string | null;
	oss_url: string;
}

/**
 * 创建对象的响应（简化版）
 */
export interface CreateKnowledgeResponse {
	type: KnowledgeObjectType;
	title: string;
	description?: string;
	textContent?: string;
	oss_url?: string;
}

/**
 * 列出对象的查询参数
 */
export interface ListKnowledgeQuery {
	title?: string;
}

/**
 * 重命名对象的请求参数
 */
export interface RenameKnowledgePayload {
	title: string;
}

//#endregion

//#region API 函数

/**
 * 创建文件或对象
 * @param data 创建对象的参数
 * @returns 创建成功的对象信息
 */
export const CreateKnowledge = (data: CreateKnowledgePayload): Promise<CreateKnowledgeResponse> => {
	return request({
		url: "/knowledge/objects/create",
		method: "POST",
		data
	}) as Promise<CreateKnowledgeResponse>;
};

/**
 * 列出当前用户的文件
 * @param params 查询参数，可选标题关键词进行模糊匹配
 * @returns 对象列表
 */
export const ListKnowledge = (
	params?: ListKnowledgeQuery
): Promise<ApiResponse<KnowledgeObject[]>> => {
	return request({
		url: "/knowledge/objects/list",
		method: "GET",
		params
	}) as Promise<ApiResponse<KnowledgeObject[]>>;
};

/**
 * 重命名对象
 * @param objectId 对象 ID
 * @param data 新标题，同一用户内唯一
 * @returns 更新后的对象信息
 */
export const RenameKnowledge = (
	objectId: number | string,
	data: RenameKnowledgePayload
): Promise<ApiResponse<KnowledgeObject>> => {
	return request({
		url: `/knowledge/objects/${objectId}/rename`,
		method: "PUT",
		data
	}) as Promise<ApiResponse<KnowledgeObject>>;
};

/**
 * 删除对象
 * @param objectId 对象 ID
 * @returns 删除结果
 */
export const DeleteKnowledge = (objectId: number | string): Promise<any> => {
	return request({
		url: `/knowledge/objects/${objectId}`,
		method: "DELETE"
	});
};

//#endregion
