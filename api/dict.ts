import { request } from "@/cool";

export interface DictValue {
	id: string;
	name: string; // HTML 内容
	type: string;
}

/**
 * 效力级别字典响应类型
 */
export interface LawStarXlsDict {
	key: string;
	value: Record<string, string>; // { "001": "法律", ... }
}

/**
 * 根据 key 获取字典值
 * @param key 字典键名
 */
export const GetDictByKey = (key: string): Promise<DictValue | null> => {
	return request({
		url: `/dicts/${key}`,
		method: "GET"
	});
};

/**
 * 获取效力级别字典
 */
export const GetLawStarXlsDict = (): Promise<LawStarXlsDict | null> => {
	return request({
		url: `/dicts/dict:law_star_xls`,
		method: "GET"
	});
};
