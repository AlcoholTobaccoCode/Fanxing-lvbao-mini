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

/** 引用类型 */
export type ReferenceData = CaseReference | LawItemReference;

/** 点击事件数据 */
export interface LawRefTapEvent {
	/** 引用类型 */
	type: "case" | "lawItem" | "unknown";
	/** 显示文本 */
	text: string;
	/** 完整 JSON 数据（原始解析结果） */
	json: Record<string, any> | null;
}

/**
 * 根据时效性获取对应的内联样式
 */
const lawCaseBaseStyle =
	"display:inline;padding:2px 8px;border-radius:4px;font-size:14px;text-decoration:none;";
function getTimelinessStyle(timeliness: string): string {
	if (
		timeliness.includes("已被修改") ||
		timeliness.includes("已修改") ||
		timeliness.includes("失效")
	) {
		// 已被修改/失效 - 橙黄色
		return `${lawCaseBaseStyle}color:#fa7315;background-color:#fff8f0;`;
	} else if (timeliness.includes("现行有效") || timeliness.includes("有效")) {
		// 现行有效 - 蓝色
		return `${lawCaseBaseStyle}color:#1e4ed8;background-color:#deedfd;`;
	}
	// 默认蓝色
	return `${lawCaseBaseStyle}color:#007aff;background-color:rgba(0,122,255,0.08);`;
}

/**
 * 预处理 Markdown，将 [[文本]](json) 转换为带 data 属性的链接
 */
export function preprocessLawMarkdown(markdown: string): string {
	if (!markdown) return "";

	// 匹配 [[文本内容]](JSON数据)
	const refPattern = /\[\[([^\]]+)\]\]\((\{[^)]+\})\)/g;

	return markdown.replace(refPattern, (match, text, jsonStr) => {
		try {
			const data = JSON.parse(jsonStr) as ReferenceData;
			const escapedJson = escapeHtml(jsonStr);

			if (data.type === "case") {
				// 案例引用 - 蓝色虚线下划线
				const caseStyle = `${lawCaseBaseStyle}color:#1e4ed8;background-color:#deedfd;`;
				return `<a href="#law-ref-case" class="law-case-ref" style="${caseStyle}" data-ref="${escapedJson}">${text}</a>`;
			} else if (data.type === "lawItem") {
				// 法条引用：显示时效状态，根据时效添加不同样式
				const timeliness = (data as LawItemReference).timeliness || "";
				const timelinessHtml = timeliness ? `(${timeliness})` : "";
				const inlineStyle = getTimelinessStyle(timeliness);
				return `<a href="#law-ref-item" class="law-item-ref" style="${inlineStyle}" data-ref="${escapedJson}">${text}${timelinessHtml}</a>`;
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
