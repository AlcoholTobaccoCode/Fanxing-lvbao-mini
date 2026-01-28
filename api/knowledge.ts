import { request } from "@/cool";
import { type ApiResponse } from "./types";

//#region 类型定义

/**
 * 对象类型枚举
 * 1: 文件
 * 2: 图片
 * 3: 笔记
 */
export type KnowledgeObjectType = 1 | 2 | 3;

/**
 * 知识库对象基础信息
 */
export interface KnowledgeObject {
	id: number;
	type: KnowledgeObjectType;
	title: string;
	filename: string | null;
	description: string | null;
	oss_url: string | null;
	textContent: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * 创建文件或对象的请求参数
 */
export interface CreateKnowledgePayload {
	type: KnowledgeObjectType;
	title: string;
	filename?: string;
	description?: string;
	ossUrl?: string;
	textContent?: string | null;
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
	/** 按标题模糊查询 */
	title?: string;
	/** 对象类型：1=file, 2=image, 3=note */
	type?: KnowledgeObjectType;
	/** 页码，默认1 */
	page?: number;
	/** 每页条数，1~100 */
	page_size?: number;
}

/**
 * 列表响应数据（分页）
 */
export interface ListKnowledgeResponse {
	items: KnowledgeObject[];
	total: number;
	page: number;
	pageSize: number;
	hasMore: boolean;
}

/**
 * 修改笔记内容的请求参数
 */
export interface UpdateNotePayload {
	/** add 表示尾部追加(默认换行），update 表示内容替换 */
	action: "add" | "update";
	/** 输入的文字内容 */
	content: string;
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
 * @returns 分页对象列表
 */
export const ListKnowledge = (params?: ListKnowledgeQuery): Promise<ListKnowledgeResponse> => {
	return request({
		url: "/knowledge/objects/list",
		method: "GET",
		params
	}) as Promise<ListKnowledgeResponse>;
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
): Promise<KnowledgeObject> => {
	return request({
		url: `/knowledge/objects/${objectId}/rename`,
		method: "PUT",
		data
	}) as Promise<KnowledgeObject>;
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

/**
 * 获取知识详情
 * @param objectId 对象 ID
 * @returns 对象详情
 */
export const GetKnowledgeDetail = (objectId: number | string): Promise<KnowledgeObject> => {
	return request({
		url: `/knowledge/objects/${objectId}`,
		method: "GET"
	}) as Promise<KnowledgeObject>;
};

/**
 * 修改笔记内容
 * @param objectId 对象 ID
 * @param data 修改内容，action 为 add 时追加，为 update 时替换
 * @returns 更新后的对象信息
 */
export const UpdateKnowledgeNote = (
	objectId: number | string,
	data: UpdateNotePayload
): Promise<KnowledgeObject> => {
	return request({
		url: `/knowledge/objects/${objectId}/note`,
		method: "POST",
		data
	}) as Promise<KnowledgeObject>;
};

//#endregion
