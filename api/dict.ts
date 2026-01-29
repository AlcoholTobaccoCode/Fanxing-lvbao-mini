import { request } from "@/cool";

export interface DictValue {
	id: string;
	name: string; // HTML 内容
	type: string;
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
