/**
 * 法条筛选常量配置
 */
import type { LegalLevelOption, LawTimelinessOption } from "@/cool/types/law-filter";

/**
 * 34个省级行政区
 */
export const CHINA_PROVINCES: string[] = [
	"北京",
	"天津",
	"河北",
	"山西",
	"内蒙古",
	"辽宁",
	"吉林",
	"黑龙江",
	"上海",
	"江苏",
	"浙江",
	"安徽",
	"福建",
	"江西",
	"山东",
	"河南",
	"湖北",
	"湖南",
	"广东",
	"广西",
	"海南",
	"重庆",
	"四川",
	"贵州",
	"云南",
	"西藏",
	"陕西",
	"甘肃",
	"青海",
	"宁夏",
	"新疆",
	"香港",
	"澳门",
	"台湾"
];

/**
 * 15种效力级别选项
 */
export const LEGAL_LEVEL_OPTIONS: LegalLevelOption[] = [
	{ label: "宪法", value: "宪法" },
	{ label: "法律", value: "法律" },
	{ label: "行政法规", value: "行政法规" },
	{ label: "监察法规", value: "监察法规" },
	{ label: "司法解释", value: "司法解释" },
	{ label: "部门规章", value: "部门规章" },
	{ label: "团体规定", value: "团体规定" },
	{ label: "行业规定", value: "行业规定" },
	{ label: "军事法规规章", value: "军事法规规章" },
	{ label: "地方性法规", value: "地方性法规" },
	{ label: "地方政府规章", value: "地方政府规章" },
	{ label: "地方规范性文件", value: "地方规范性文件" },
	{ label: "地方司法文件", value: "地方司法文件" },
	{ label: "地方工作文件", value: "地方工作文件" },
	{ label: "中央规范性文件", value: "中央规范性文件" }
];

/**
 * 效力级别 value -> label 映射
 */
export const LEGAL_LEVEL_MAP: Record<string, string> = LEGAL_LEVEL_OPTIONS.reduce(
	(acc, item) => {
		acc[item.value] = item.label;
		return acc;
	},
	{} as Record<string, string>
);

/**
 * 4种时效性选项
 */
export const LAW_TIMELINESS_OPTIONS: LawTimelinessOption[] = [
	{ label: "现行有效", value: "现行有效" },
	{ label: "尚未生效", value: "尚未生效" },
	{ label: "已被修改", value: "已被修改" },
	{ label: "已失效", value: "已失效" }
];

/**
 * 时效性 value -> label 映射
 */
export const LAW_TIMELINESS_MAP: Record<string, string> = LAW_TIMELINESS_OPTIONS.reduce(
	(acc, item) => {
		acc[item.value] = item.label;
		return acc;
	},
	{} as Record<string, string>
);

/**
 * 最近选择地区最大数量
 */
export const MAX_RECENT_AREAS = 5;
