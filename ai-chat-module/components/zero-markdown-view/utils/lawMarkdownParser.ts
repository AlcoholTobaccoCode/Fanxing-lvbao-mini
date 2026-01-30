/**
 * 法律 Markdown 解析器
 * 处理特殊语法：案例引用 [[案号]](json)、法条引用 [[法条名]](json)
 */

/** 案例引用数据 */
export interface CaseReference {
	type: "case";
	caseNo: string;
}

/** 法条引用数据 */
export interface LawItemReference {
	type: "lawItem";
	lawId: string;
	lawItemId: string;
	timeliness: string;
}

/** 法规引用数据（整部法规，无具体条款） */
export interface LawReference {
	type: "law";
	lawId: string;
	timeliness: string;
	lawItemId?: string; // 为空或不存在
}

/** 联网搜索引用数据 */
export interface SearchReference {
	type: "search";
	hostName?: string;
	hostLogo?: string;
	indexId?: number;
	time?: string;
	title?: string;
	body?: string;
	url?: string;
}

/** 引用类型 */
export type ReferenceData = CaseReference | LawItemReference | LawReference | SearchReference;

/** 点击事件数据 */
export interface LawRefTapEvent {
	/** 引用类型 */
	type: "case" | "lawItem" | "law" | "search" | "unknown";
	/** 显示文本 */
	text: string;
	/** 完整 JSON 数据（原始解析结果） */
	json: Record<string, any> | null;
}

/**
 * 获取引用标签的基础内联样式
 * @param scale 字体缩放比例
 */
function getLawCaseBaseStyle(scale: number = 1): string {
	const fontSize = Math.round(14 * scale);
	return `display:inline;padding:2px 8px;border-radius:4px;font-size:${fontSize}px;text-decoration:none;`;
}

/**
 * 根据时效性获取对应的内联样式
 * @param timeliness 时效性文本
 * @param scale 字体缩放比例
 */
function getTimelinessStyle(timeliness: string, scale: number = 1): string {
	const baseStyle = getLawCaseBaseStyle(scale);
	if (
		timeliness.includes("已被修改") ||
		timeliness.includes("已修改") ||
		timeliness.includes("失效")
	) {
		// 已被修改/失效 - 橙黄色
		return `${baseStyle}color:#fa7315;background-color:#fff8f0;`;
	} else if (timeliness.includes("现行有效") || timeliness.includes("有效")) {
		// 现行有效 - 蓝色
		return `${baseStyle}color:#1e4ed8;background-color:#deedfd;`;
	}
	// 默认蓝色
	return `${baseStyle}color:#007aff;background-color:rgba(0,122,255,0.08);`;
}

/**
 * 预处理 Markdown，将 [[文本]](json) 或 [文本](json) 转换为带 data 属性的链接
 * @param markdown Markdown 内容
 * @param scale 字体缩放比例（默认 1）
 */
export function preprocessLawMarkdown(markdown: string, scale: number = 1): string {
	if (!markdown) return "";

	// 匹配 [[文本]](JSON) 或 [文本](JSON)，使用 [\s\S]*? 非贪婪匹配支持 JSON 中的任意字符
	const refPattern = /\[?\[([^\]]+)\]\]?\(\s*(\{[\s\S]*?\})\s*\)/g;

	return markdown.replace(refPattern, (match, text, jsonStr) => {
		try {
			const data = JSON.parse(jsonStr) as ReferenceData;
			const escapedJson = escapeHtml(jsonStr);
			const baseStyle = getLawCaseBaseStyle(scale);

			if (data.type === "case") {
				// 案例引用 - 蓝色样式
				const caseStyle = `${baseStyle}color:#1e4ed8;background-color:#deedfd;`;
				return `<a href="#law-ref-case" class="law-case-ref" style="${caseStyle}" data-ref="${escapedJson}">${text}</a>`;
			} else if (data.type === "lawItem") {
				// 法条引用：显示时效状态，根据时效添加不同样式
				const timeliness = (data as LawItemReference).timeliness || "";
				const timelinessHtml = timeliness ? `(${timeliness})` : "";
				const inlineStyle = getTimelinessStyle(timeliness, scale);
				return `<a href="#law-ref-item" class="law-item-ref" style="${inlineStyle}" data-ref="${escapedJson}">${text}${timelinessHtml}</a>`;
			} else if (data.type === "law") {
				// 法规引用（整部法规）：样式与法条相同
				const timeliness = (data as LawReference).timeliness || "";
				const timelinessHtml = timeliness ? `(${timeliness})` : "";
				const inlineStyle = getTimelinessStyle(timeliness, scale);
				return `<a href="#law-ref-law" class="law-ref" style="${inlineStyle}" data-ref="${escapedJson}">${text}${timelinessHtml}</a>`;
			} else if (data.type === "search") {
				// 联网搜索引用 - 绿色样式
				const searchStyle = `${baseStyle}color:#059669;background-color:#ecfdf5;`;
				return `<a href="#law-ref-search" class="law-search-ref" style="${searchStyle}" data-ref="${escapedJson}">${text}</a>`;
			}

			return match;
		} catch (e) {
			console.error("[lawMarkdownParser] JSON 解析失败:", jsonStr);
			return match;
		}
	});
}

/**
 * 解析 linktap 事件中的引用数据
 */
export function parseLawLinkTap(attrs: {
	href?: string;
	"data-ref"?: string;
	innerText?: string;
}): LawRefTapEvent | null {
	const href = attrs.href || "";
	// 非法律引用链接
	if (!href.startsWith("#law-ref")) return null;

	const dataRef = attrs["data-ref"];
	const text = attrs.innerText || "";
	let type: LawRefTapEvent["type"] = "unknown";
	let json: Record<string, any> | null = null;

	if (href === "#law-ref-case") type = "case";
	else if (href === "#law-ref-item") type = "lawItem";
	else if (href === "#law-ref-law") type = "law";
	else if (href === "#law-ref-search") type = "search";

	if (dataRef) {
		try {
			// 先解码 HTML 实体再解析 JSON
			json = JSON.parse(unescapeHtml(dataRef));
		} catch (e) {
			console.error("[parseLawLinkTap] 解析失败:", dataRef);
		}
	}

	return { type, text, json };
}

/** 转义 HTML */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/** 解码 HTML 实体 */
function unescapeHtml(str: string): string {
	return str
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}
