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
		if (!markdown) return '';

		let text = markdown
			// 移除标题标记
			.replace(/^#{1,6}\s+/gm, '')
			// 移除粗体
			.replace(/\*\*(.*?)\*\*/g, '$1')
			// 移除斜体
			.replace(/\*(.*?)\*/g, '$1')
			// 移除删除线
			.replace(/~~(.*?)~~/g, '$1')
			// 移除链接，保留文本
			.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
			// 移除图片
			.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
			// 移除代码块
			.replace(/```[\s\S]*?```/g, '')
			// 移除行内代码
			.replace(/`([^`]+)`/g, '$1')
			// 移除引用标记
			.replace(/^>\s+/gm, '')
			// 移除列表标记
			.replace(/^[\*\-\+]\s+/gm, '• ')
			.replace(/^\d+\.\s+/gm, '')
			// 移除多余空行
			.replace(/\n{3,}/g, '\n\n');

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
		const paragraphs = text.split('\n');

		paragraphs.forEach(paragraph => {
			if (!paragraph.trim()) {
				lines.push('');
				return;
			}

			let currentLine = '';
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
		lineHeight: 36,
		titleFontSize: 40,
		contentFontSize: 24,
		titleColor: '#1a1a1a',
		contentColor: '#333333',
		dividerColor: '#e5e7eb',
		backgroundColor: '#ffffff'
	};

	/**
	 * 导出 Markdown 为图片
	 * @param {Object} options 配置选项
	 * @param {String} options.canvasId - Canvas ID
	 * @param {String} options.title - 文档标题
	 * @param {String} options.content - Markdown 内容
	 * @param {Object} options.config - 自定义配置
	 * @returns {Promise<String>} 图片临时路径
	 */
	static async exportToImage(options) {
		const { canvasId, title, content, config = {} } = options;
		const finalConfig = { ...this.defaultConfig, ...config };

		return new Promise((resolve, reject) => {
			console.log('开始导出 Markdown 为图片');

			const query = uni.createSelectorQuery();
			query
				.select('#' + canvasId)
				.fields({ node: true, size: true })
				.exec((res) => {
					if (!res || !res[0] || !res[0].node) {
						reject(new Error('Canvas 节点未找到'));
						return;
					}

					try {
						const canvas = res[0].node;
						const ctx = canvas.getContext('2d');
						const dpr = uni.getSystemInfoSync().pixelRatio;

						// 解析 markdown
						const plainText = MarkdownParser.parseToText(content);
						console.log('文本长度:', plainText.length);

						// 计算布局
						const layout = this._calculateLayout(ctx, plainText, title, finalConfig);
						console.log('布局信息:', layout);

						// 设置 canvas 尺寸
						canvas.width = layout.width * dpr;
						canvas.height = layout.height * dpr;
						ctx.scale(dpr, dpr);

						// 绘制内容
						this._drawContent(ctx, layout, finalConfig);

						// 导出图片
						this._exportCanvas(canvas, resolve, reject);
					} catch (error) {
						console.error('绘制失败:', error);
						reject(error);
					}
				});
		});
	}

	/**
	 * 计算布局信息
	 * @private
	 */
	static _calculateLayout(ctx, plainText, title, config) {
		const { width, padding, lineHeight, contentFontSize } = config;

		// 计算文本行
		ctx.font = `${contentFontSize}px sans-serif`;
		const maxWidth = width - padding * 2;
		const lines = TextRenderer.wrapText(ctx, plainText, maxWidth);

		// 计算高度
		const titleHeight = 140;
		const contentHeight = lines.length * lineHeight;
		const bottomPadding = 60;
		const totalHeight = titleHeight + contentHeight + bottomPadding;

		return {
			width,
			height: Math.max(1200, totalHeight),
			lines,
			title,
			maxWidth,
			titleHeight
		};
	}

	/**
	 * 绘制内容到 Canvas
	 * @private
	 */
	static _drawContent(ctx, layout, config) {
		const { width, height, lines, title, titleHeight } = layout;
		const {
			padding,
			lineHeight,
			titleFontSize,
			contentFontSize,
			titleColor,
			contentColor,
			dividerColor,
			backgroundColor
		} = config;

		// 绘制背景
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(0, 0, width, height);

		// 绘制标题
		ctx.fillStyle = titleColor;
		ctx.font = `bold ${titleFontSize}px sans-serif`;
		ctx.textAlign = 'center';
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
		ctx.textAlign = 'left';

		let y = 180;
		lines.forEach((line) => {
			if (line) {
				ctx.fillText(line, padding, y);
			}
			y += lineHeight;
		});
	}

	/**
	 * 导出 Canvas 为图片
	 * @private
	 */
	static _exportCanvas(canvas, resolve, reject) {
		setTimeout(() => {
			uni.canvasToTempFilePath({
				canvas: canvas,
				fileType: 'png',
				quality: 0.9,
				success: (res) => {
					console.log('Canvas 导出成功:', res.tempFilePath);
					resolve(res.tempFilePath);
				},
				fail: (err) => {
					console.error('Canvas 导出失败:', err);
					reject(new Error('Canvas 导出失败: ' + JSON.stringify(err)));
				}
			});
		}, 500);
	}
}
