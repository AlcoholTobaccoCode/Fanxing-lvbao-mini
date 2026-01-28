/**
 * HTML 转 Markdown 工具
 * 将富文本编辑器输出的 HTML 转换回 Markdown 格式
 */

/**
 * 将 HTML 字符串转换为 Markdown 格式
 * @param html HTML 字符串
 * @returns Markdown 字符串
 */
export function htmlToMarkdown(html: string): string {
	if (!html) return "";

	let result = html;

	// 处理标题 h1-h6
	result = result.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
	result = result.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
	result = result.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
	result = result.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
	result = result.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n");
	result = result.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

	// 处理加粗
	result = result.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
	result = result.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");

	// 处理斜体
	result = result.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
	result = result.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");

	// 处理删除线
	result = result.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, "~~$1~~");
	result = result.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, "~~$1~~");
	result = result.replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, "~~$1~~");

	// 处理下划线（Markdown 不支持，保留文本）
	result = result.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, "$1");

	// 处理链接
	result = result.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

	// 处理图片
	result = result.replace(
		/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi,
		"![$2]($1)"
	);
	result = result.replace(
		/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']*)["'][^>]*\/?>/gi,
		"![$1]($2)"
	);
	result = result.replace(/<img[^>]*src=["']([^"']*)["'][^>]*\/?>/gi, "![]($1)");

	// 处理代码块
	result = result.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n");
	result = result.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n");

	// 处理行内代码
	result = result.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

	// 处理引用块
	result = result.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
		const lines = content.trim().split("\n");
		return "\n" + lines.map((line: string) => `> ${line.trim()}`).join("\n") + "\n";
	});

	// 处理无序列表
	result = result.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
		return "\n" + content + "\n";
	});

	// 处理有序列表
	result = result.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
		let index = 0;
		return (
			"\n" +
			content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, item: string) => {
				index++;
				return `${index}. ${item.trim()}\n`;
			}) +
			"\n"
		);
	});

	// 处理列表项（无序）
	result = result.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");

	// 处理段落
	result = result.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");

	// 处理换行
	result = result.replace(/<br\s*\/?>/gi, "\n");

	// 处理水平线
	result = result.replace(/<hr\s*\/?>/gi, "\n---\n");

	// 处理 div（转为段落）
	result = result.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, "\n$1\n");

	// 处理 span（保留内容）
	result = result.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, "$1");

	// 移除其他 HTML 标签
	result = result.replace(/<[^>]+>/g, "");

	// 解码 HTML 实体
	result = decodeHtmlEntities(result);

	// 清理多余空行（保留最多两个连续换行）
	result = result.replace(/\n{3,}/g, "\n\n");

	// 清理首尾空白
	result = result.trim();

	return result;
}

/**
 * 解码常见的 HTML 实体
 */
function decodeHtmlEntities(text: string): string {
	const entities: Record<string, string> = {
		"&nbsp;": " ",
		"&amp;": "&",
		"&lt;": "<",
		"&gt;": ">",
		"&quot;": '"',
		"&#39;": "'",
		"&apos;": "'",
		"&copy;": "©",
		"&reg;": "®",
		"&trade;": "™",
		"&mdash;": "—",
		"&ndash;": "–",
		"&hellip;": "…",
		"&lsquo;": "'",
		"&rsquo;": "'",
		"&ldquo;": '"',
		"&rdquo;": '"'
	};

	let result = text;
	for (const [entity, char] of Object.entries(entities)) {
		result = result.replace(new RegExp(entity, "g"), char);
	}

	// 处理数字实体 &#xxx;
	result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

	return result;
}
