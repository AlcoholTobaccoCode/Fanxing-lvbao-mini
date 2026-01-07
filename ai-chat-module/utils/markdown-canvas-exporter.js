import { config } from "@/config";
import { useStore } from "@/cool";
/**
 * Markdown Canvas 导出工具类
 * 用于将 Markdown 内容导出为图片
 * @author lanlan
 * @date 2026-01-07
 */

/**
 * Markdown 解析器
 * 将 markdown 语法转换为纯文本
 */
export class MarkdownParser {
	/**
	 * 解析 markdown 为纯文本
	 * @param {String} markdown - markdown 内容
	 * @returns {String} 纯文本内容
	 */
	static parseToText(markdown) {
		if (!markdown) return "";

		let text = markdown
			// 移除标题标记
			.replace(/^#{1,6}\s+/gm, "")
			// 移除粗体
			.replace(/\*\*(.*?)\*\*/g, "$1")
			// 移除斜体
			.replace(/\*(.*?)\*/g, "$1")
			// 移除删除线
			.replace(/~~(.*?)~~/g, "$1")
			// 移除链接，保留文本
			.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
			// 移除图片
			.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "")
			// 移除代码块
			.replace(/```[\s\S]*?```/g, "")
			// 移除行内代码
			.replace(/`([^`]+)`/g, "$1")
			// 移除引用标记
			.replace(/^>\s+/gm, "")
			// 移除列表标记
			.replace(/^[\*\-\+]\s+/gm, "• ")
			.replace(/^\d+\.\s+/gm, "")
			// 移除多余空行
			.replace(/\n{3,}/g, "\n\n");

		return text.trim();
	}
}

/**
 * 文本渲染器
 * 处理文本换行和绘制
 */
export class TextRenderer {
	/**
	 * 文本自动换行
	 * @param {CanvasContext} ctx - Canvas 上下文
	 * @param {String} text - 文本内容
	 * @param {Number} maxWidth - 最大宽度
	 * @returns {Array} 换行后的文本数组
	 */
	static wrapText(ctx, text, maxWidth) {
		const lines = [];
		const paragraphs = text.split("\n");

		paragraphs.forEach((paragraph) => {
			if (!paragraph.trim()) {
				lines.push("");
				return;
			}

			let currentLine = "";
			for (let i = 0; i < paragraph.length; i++) {
				const testLine = currentLine + paragraph[i];
				const metrics = ctx.measureText(testLine);

				if (metrics.width > maxWidth && currentLine) {
					lines.push(currentLine);
					currentLine = paragraph[i];
				} else {
					currentLine = testLine;
				}
			}

			if (currentLine) {
				lines.push(currentLine);
			}
		});

		return lines;
	}
}

/**
 * Canvas 导出器
 * 将 Markdown 内容绘制到 Canvas 并导出为图片
 */
export class CanvasExporter {
	/**
	 * 导出配置
	 */
	static defaultConfig = {
		width: 750,
		padding: 60,
		lineHeight: 90,
		titleFontSize: 40,
		contentFontSize: 24,
		titleColor: "#1a1a1a",
		contentColor: "#333",
		dividerColor: "#e5e7eb",
		backgroundColor: "#fff",
		maxCanvasHeight: 8192 // 微信小程序 Canvas 物理像素最大高度限制
	};

	/**
	 * 导出 Markdown 为图片（支持分页）
	 * @param {Object} options 配置选项
	 * @param {String} options.canvasId - Canvas ID
	 * @param {String} options.title - 文档标题
	 * @param {String} options.content - Markdown 内容
	 * @param {Object} options.config - 自定义配置
	 * @returns {Promise<Array>} 图片临时路径数组
	 */
	static async exportToImage(options) {
		const { canvasId, title, content, config = {} } = options;
		const finalConfig = { ...this.defaultConfig, ...config };

		return new Promise((resolve, reject) => {
			console.log("开始导出 Markdown 为图片");

			const query = uni.createSelectorQuery();
			query
				.select("#" + canvasId)
				.fields({ node: true, size: true })
				.exec(async (res) => {
					if (!res || !res[0] || !res[0].node) {
						reject(new Error("Canvas 节点未找到"));
						return;
					}

					try {
						const canvas = res[0].node;
						const ctx = canvas.getContext("2d");
						const dpr = uni.getSystemInfoSync().pixelRatio;

						// 解析 markdown
						const plainText = MarkdownParser.parseToText(content);
						console.log("文本长度:", plainText.length);
						console.log("设备像素比 (dpr):", dpr);

						// 计算布局 - 传入 dpr 以正确计算物理像素限制
						const layout = this._calculateLayout(ctx, plainText, title, finalConfig, dpr);
						console.log("布局信息:", layout);

						// 如果需要分页
						if (layout.needsPagination) {
							console.log(`内容需要分 ${layout.totalPages} 页`);
							const imagePaths = await this._exportMultiplePages(
								canvas,
								ctx,
								dpr,
								layout,
								finalConfig
							);
							resolve(imagePaths);
						} else {
							// 单页导出
							const imagePath = await this._exportSinglePage(
								canvas,
								ctx,
								dpr,
								layout,
								finalConfig
							);
							resolve([imagePath]);
						}
					} catch (error) {
						console.error("绘制失败:", error);
						reject(error);
					}
				});
		});
	}

	/**
	 * 计算布局信息（支持分页）
	 * @private
	 */
	static _calculateLayout(ctx, plainText, title, config, dpr) {
		const { width, padding, lineHeight, contentFontSize, maxCanvasHeight } = config;

		// 计算文本行
		ctx.font = `${contentFontSize}px sans-serif`;
		const maxWidth = width - padding * 2;
		const lines = TextRenderer.wrapText(ctx, plainText, maxWidth);

		// 计算高度 - 增加更多的安全边距
		const titleHeight = 140;
		const bottomPadding = 100; // 增加底部边距
		const pagePadding = 40; // 页码区域

		// 关键修复：将物理像素限制转换为逻辑像素
		const maxLogicalHeight = Math.floor(maxCanvasHeight / dpr);

		console.log("高度限制计算:", {
			maxCanvasHeight,
			dpr,
			maxLogicalHeight
		});

		// 计算每页可以显示的行数 - 使用逻辑像素高度
		const maxContentHeight = maxLogicalHeight - titleHeight - bottomPadding - pagePadding;
		let linesPerPage = Math.floor(maxContentHeight / lineHeight);

		// 确保至少每页显示 10 行，但不超过安全限制
		if (linesPerPage < 10) {
			linesPerPage = 10;
			console.warn("每页行数太少，强制设置为 10 行");
		}

		// 再次验证计算出的高度是否安全
		const calculatedHeight =
			titleHeight + linesPerPage * lineHeight + bottomPadding + pagePadding;
		if (calculatedHeight > maxLogicalHeight) {
			// 如果还是超限，减少每页行数
			linesPerPage = Math.floor(
				(maxLogicalHeight - titleHeight - bottomPadding - pagePadding) / lineHeight
			);
			console.warn(`调整每页行数为 ${linesPerPage} 以确保不超限`);
		}

		// 计算总页数
		const totalPages = Math.ceil(lines.length / linesPerPage);

		console.log("分页计算:", {
			totalLines: lines.length,
			lineHeight,
			maxContentHeight,
			linesPerPage,
			totalPages,
			maxCanvasHeight,
			maxLogicalHeight,
			calculatedHeight: titleHeight + linesPerPage * lineHeight + bottomPadding + pagePadding
		});

		return {
			width,
			lines,
			title,
			maxWidth,
			titleHeight,
			lineHeight,
			linesPerPage,
			totalPages,
			needsPagination: totalPages > 1
		};
	}

	/**
	 * 绘制单页内容到 Canvas
	 * @private
	 */
	static _drawContent(ctx, layout, config, pageNum = 1) {
		const { width, lines, title, titleHeight, lineHeight, linesPerPage, totalPages } = layout;
		const {
			padding,
			titleFontSize,
			contentFontSize,
			titleColor,
			contentColor,
			dividerColor,
			backgroundColor
		} = config;

		// 计算当前页的行范围
		const startLine = (pageNum - 1) * linesPerPage;
		const endLine = Math.min(startLine + linesPerPage, lines.length);
		const pageLines = lines.slice(startLine, endLine);

		console.log(`绘制第 ${pageNum} 页:`, {
			startLine,
			endLine,
			pageLines: pageLines.length
		});

		// 绘制背景（使用 Canvas 的实际高度）
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(0, 0, width, 10000); // 使用足够大的高度

		// 绘制标题
		ctx.fillStyle = titleColor;
		ctx.font = `bold ${titleFontSize}px sans-serif`;
		ctx.textAlign = "center";
		ctx.fillText(title, width / 2, 80);

		// 绘制分割线
		ctx.strokeStyle = dividerColor;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(padding, 140);
		ctx.lineTo(width - padding, 140);
		ctx.stroke();

		// 绘制文本内容
		ctx.fillStyle = contentColor;
		ctx.font = `${contentFontSize}px sans-serif`;
		ctx.textAlign = "left";

		let y = 180;
		pageLines.forEach((line) => {
			if (line) {
				ctx.fillText(line, padding, y);
			}
			y += lineHeight;
		});

		// 绘制页码
		if (totalPages > 1) {
			ctx.fillStyle = "#999";
			ctx.font = "20px sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(`${pageNum}/${totalPages}`, width / 2, y + 40);
		}
	}

	/**
	 * 导出单页
	 * @private
	 */
	static async _exportSinglePage(canvas, ctx, dpr, layout, config) {
		const { width, titleHeight, lineHeight, linesPerPage } = layout;
		const { maxCanvasHeight } = config;

		// 计算逻辑像素高度限制
		const maxLogicalHeight = Math.floor(maxCanvasHeight / dpr);

		// 使用 linesPerPage 而不是所有行数
		const actualLines = Math.min(layout.lines.length, linesPerPage);
		const pageHeight = Math.min(titleHeight + actualLines * lineHeight + 100, maxLogicalHeight);

		console.log("单页导出高度:", {
			totalLines: layout.lines.length,
			actualLines,
			linesPerPage,
			pageHeight,
			maxLogicalHeight,
			physicalHeight: pageHeight * dpr
		});

		// 设置 canvas 尺寸
		canvas.width = width * dpr;
		canvas.height = pageHeight * dpr;
		ctx.scale(dpr, dpr);

		// 绘制内容
		this._drawContent(ctx, layout, config, 1);

		return this._exportCanvasToFile(canvas);
	}

	/**
	 * 导出多页
	 * @private
	 */
	static async _exportMultiplePages(canvas, ctx, dpr, layout, config) {
		const { width, totalPages, titleHeight, lineHeight, linesPerPage } = layout;
		const { maxCanvasHeight } = config;
		const imagePaths = [];

		// 计算逻辑像素高度限制
		const maxLogicalHeight = Math.floor(maxCanvasHeight / dpr);

		for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
			console.log(`正在生成第 ${pageNum}/${totalPages} 页`);

			// 计算当前页的行数
			const startLine = (pageNum - 1) * linesPerPage;
			const endLine = Math.min(startLine + linesPerPage, layout.lines.length);
			const currentPageLines = endLine - startLine;

			// 计算当前页高度，增加底部边距
			const pageHeight = Math.min(
				titleHeight + currentPageLines * lineHeight + 100,
				maxLogicalHeight
			);

			console.log(`第 ${pageNum} 页高度计算:`, {
				startLine,
				endLine,
				currentPageLines,
				pageHeight,
				maxLogicalHeight,
				physicalHeight: pageHeight * dpr
			});

			// 严格检查高度是否超限
			if (pageHeight > maxLogicalHeight) {
				console.error(`第 ${pageNum} 页高度超限: ${pageHeight} > ${maxLogicalHeight}`);
				throw new Error(`页面高度超出限制: ${pageHeight}px`);
			}

			// 重新设置 canvas 尺寸（会重置 context）
			canvas.width = width * dpr;
			canvas.height = pageHeight * dpr;

			// 重新获取 context 并设置缩放
			const newCtx = canvas.getContext("2d");
			newCtx.scale(dpr, dpr);

			// 绘制当前页
			this._drawContent(newCtx, layout, config, pageNum);

			// 导出当前页
			const imagePath = await this._exportCanvasToFile(canvas);
			imagePaths.push(imagePath);

			// 等待一下
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		return imagePaths;
	}

	/**
	 * 导出 Canvas 为图片文件
	 * @private
	 */
	static _exportCanvasToFile(canvas) {
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				uni.canvasToTempFilePath({
					canvas: canvas,
					fileType: "png",
					quality: 0.9,
					success: (res) => {
						console.log("Canvas 导出成功:", res.tempFilePath);
						resolve(res.tempFilePath);
					},
					fail: (err) => {
						console.error("Canvas 导出失败:", err);
						reject(new Error("Canvas 导出失败: " + JSON.stringify(err)));
					}
				});
			}, 300);
		});
	}
}

/**
 * Word 导出器
 * 调用后端 API 将 Markdown 转换为 Word 文档
 */
export class WordExporter {
	/**
	 * 导出 Markdown 为 Word 文档
	 * @param {Object} options 配置选项
	 * @param {String} options.content - Markdown 内容
	 * @param {String} options.filename - 文件名
	 * @returns {Promise<String>} 返回文件临时路径
	 */
	static async exportToWord(options) {
		const { content, filename = "文档.docx" } = options;

		if (!content) {
			throw new Error("内容不能为空");
		}

		console.log("开始导出 Word 文档");

		return new Promise((resolve, reject) => {
			const { user } = useStore();
			uni.request({
				url: `${config.baseUrl}/utils/md-to-docx`,
				method: "POST",
				header: {
					Authorization: user.token
				},
				data: {
					content: content,
					filename: filename
				},
				responseType: "arraybuffer",
				success: (res) => {
					if (res.statusCode === 200) {
						console.log("Word 生成成功");

						// 将 arraybuffer 保存为临时文件
						const fs = uni.getFileSystemManager();
						const filePath = `${wx.env.USER_DATA_PATH}/${filename}`;

						fs.writeFile({
							filePath: filePath,
							data: res.data,
							encoding: "binary",
							success: () => {
								console.log("Word 文件保存成功:", filePath);
								resolve(filePath);
							},
							fail: (err) => {
								console.error("Word 文件保存失败:", err);
								reject(new Error("文件保存失败"));
							}
						});
					} else {
						console.error("Word 导出失败:", res);
						reject(new Error("导出失败"));
					}
				},
				fail: (err) => {
					console.error("Word 导出请求失败:", err);
					reject(new Error("网络请求失败"));
				}
			});
		});
	}
}
