/**
 * 法条筛选类型定义
 */

/**
 * 法条筛选条件
 */
export interface LawFilters {
	/** 地区筛选 (多选) */
	area_facet: string[];
	/** 效力级别筛选 (多选) */
	xls: string[];
	/** 时效性筛选 (单选) */
	lawstatexls_facet: string | null;
}

/**
 * 效力级别选项
 */
export interface LegalLevelOption {
	label: string;
	value: string;
}

/**
 * 时效性选项
 */
export interface LawTimelinessOption {
	label: string;
	value: string;
}

/**
 * 创建空的筛选条件
 */
export const createEmptyFilters = (): LawFilters => ({
	area_facet: [],
	xls: [],
	lawstatexls_facet: null
});
