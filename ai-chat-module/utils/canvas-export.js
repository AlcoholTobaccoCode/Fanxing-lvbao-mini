/**
 * Canvas 导出工具类
 * 用于将富文本内容导出为图片
 * @author lanlan
 * @date 2026-01-06
 */

/**
 * 将编辑器内容导出为图片
 * @param {Object} options 配置选项
 * @param {String} options.selector 编辑器选择器 (例如: '#sv-editor')
 * @param {String} options.title 文档标题
 * @param {Number} options.width 画布宽度 (默认: 750)
 * @param {Number} options.quality 图片质量 0-1 (默认: 0.9)
 * @param {Object} options.context 组件上下文 (this)
 * @param {String} options.canvasId Canvas ID
 * @returns {Promise<String>} 返回临时图片路径
 */
export async function exportToImage(options = {}) {
	const {
		selector = '.sv-editor-container',
		title = '文档',
		width = 750,
		quality = 0.9,
		context = null,
		canvasId = 'export-canvas'
	} = options;

	return new Promise((resolve, reject) => {
		try {
			console.log('开始导出图片，参数:', { selector, title, canvasId, context: !!context });

			// 创建查询节点 - 页面直接使用 createSelectorQuery()
			const query = uni.createSelectorQuery();

			// 尝试多个选择器
			query.select(selector).boundingClientRect();
			query.select('#sv-editor').boundingClientRect();
			query.select('.sv-editor-wrapper').boundingClientRect();
			query.selectAll('editor').boundingClientRect();

			query.exec((res) => {
				console.log('查询结果 (所有选择器):', res);
				console.log('查询结果详情:', JSON.stringify(res));

				// 找到第一个有效的结果
				let rect = null;
				for (let i = 0; i < res.length; i++) {
					if (res[i] && res[i].width && res[i].height) {
						rect = res[i];
						console.log('找到有效节点，索引:', i, '数据:', rect);
						break;
					}
				}

				if (!rect) {
					console.error('所有选择器都未找到节点');
					return reject(new Error('未找到编辑器节点，请确保编辑器已加载'));
				}

				// 创建离屏 canvas
				createCanvasContext(canvasId, rect, title, width, quality)
					.then(resolve)
					.catch(reject);
			});
		} catch (error) {
			console.error('导出图片异常:', error);
			reject(error);
		}
	});
}

/**
 * 创建 Canvas 上下文并绘制内容
 */
function createCanvasContext(canvasId, rect, title, width, quality) {
	return new Promise((resolve, reject) => {
		// 计算画布高度 (保持宽高比)
		const scale = width / (rect.width || 750);
		const height = (rect.height || 1000) * scale + 200; // 额外空间给标题和边距

		console.log('Canvas 参数:', { canvasId, rect, width, height, scale });

		// 创建 canvas 上下文
		const ctx = uni.createCanvasContext(canvasId);

		// 设置背景色
		ctx.setFillStyle('#ffffff');
		ctx.fillRect(0, 0, width, height);

		// 绘制标题
		ctx.setFillStyle('#1a1a1a');
		ctx.setFontSize(36);
		ctx.setTextAlign('center');
		ctx.fillText(title, width / 2, 80);

		// 绘制分割线
		ctx.setStrokeStyle('#e5e7eb');
		ctx.setLineWidth(2);
		ctx.moveTo(60, 130);
		ctx.lineTo(width - 60, 130);
		ctx.stroke();

		// 绘制提示文字
		ctx.setFillStyle('#666666');
		ctx.setFontSize(24);
		ctx.setTextAlign('center');
		ctx.fillText('文档内容预览', width / 2, 180);

		// 提交绘制
		ctx.draw(false, () => {
			// 延迟确保绘制完成
			setTimeout(() => {
				// 导出为临时文件
				uni.canvasToTempFilePath({
					canvasId: canvasId,
					fileType: 'png',
					quality: quality,
					success: (res) => {
						console.log('Canvas 导出成功:', res.tempFilePath);
						resolve(res.tempFilePath);
					},
					fail: (err) => {
						console.error('Canvas 导出失败:', err);
						reject(err);
					}
				});
			}, 500);
		});
	});
}

/**
 * 使用 HTML2Canvas 方式导出 (适用于 H5 和 APP)
 * @param {Object} options 配置选项
 * @returns {Promise<String>} 返回图片 base64 或临时路径
 */
export async function exportToImageByHTML(options = {}) {
	const {
		selector = '.sv-editor-container',
		title = '文档',
		quality = 0.9
	} = options;

	// #ifdef H5 || APP
	return new Promise((resolve, reject) => {
		const query = uni.createSelectorQuery();

		query.select(selector).fields({
			node: true,
			size: true,
			scrollOffset: true
		}).exec((res) => {
			if (!res || !res[0]) {
				return reject(new Error('未找到编辑器节点'));
			}

			const node = res[0];

			// 使用 canvas API 截图
			captureNodeToCanvas(node, title, quality)
				.then(resolve)
				.catch(reject);
		});
	});
	// #endif

	// #ifdef MP-WEIXIN
	// 微信小程序使用原生 canvas
	return exportToImage(options);
	// #endif
}

/**
 * 将 DOM 节点绘制到 Canvas
 */
function captureNodeToCanvas(node, title, quality) {
	return new Promise((resolve, reject) => {
		try {
			// 创建离屏 canvas
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			canvas.width = node.width || 750;
			canvas.height = (node.height || 1000) + 120; // 额外空间给标题

			// 绘制白色背景
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// 绘制标题
			ctx.fillStyle = '#333333';
			ctx.font = 'bold 24px sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(title, canvas.width / 2, 50);

			// 绘制分割线
			ctx.strokeStyle = '#e5e7eb';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(30, 80);
			ctx.lineTo(canvas.width - 30, 80);
			ctx.stroke();

			// 将内容绘制到 canvas (这里需要遍历 HTML 内容)
			// 注意: 完整实现需要解析 HTML 并逐个绘制元素

			// 导出为图片
			const dataURL = canvas.toDataURL('image/png', quality);
			resolve(dataURL);
		} catch (error) {
			reject(error);
		}
	});
}

/**
 * 保存图片到相册
 * @param {String} filePath 图片临时路径
 * @returns {Promise}
 */
export function saveImageToAlbum(filePath) {
	return new Promise((resolve, reject) => {
		// 先授权
		uni.authorize({
			scope: 'scope.writePhotosAlbum',
			success: () => {
				// 保存到相册
				uni.saveImageToPhotosAlbum({
					filePath: filePath,
					success: () => {
						uni.showToast({
							title: '已保存到相册',
							icon: 'success'
						});
						resolve();
					},
					fail: (err) => {
						uni.showToast({
							title: '保存失败',
							icon: 'none'
						});
						reject(err);
					}
				});
			},
			fail: () => {
				// 授权失败,引导用户手动授权
				uni.showModal({
					title: '提示',
					content: '需要您授权保存图片到相册',
					success: (res) => {
						if (res.confirm) {
							uni.openSetting();
						}
					}
				});
				reject(new Error('未授权'));
			}
		});
	});
}

/**
 * 分享图片
 * @param {String} filePath 图片临时路径
 * @returns {Promise}
 */
export function shareImage(filePath) {
	return new Promise((resolve, reject) => {
		// #ifdef MP-WEIXIN
		// 微信小程序分享
		uni.showShareImageMenu({
			path: filePath,
			success: () => {
				resolve();
			},
			fail: (err) => {
				reject(err);
			}
		});
		// #endif

		// #ifdef H5
		// H5 环境提示下载
		uni.showModal({
			title: '提示',
			content: '请长按图片保存或分享',
			showCancel: false
		});
		resolve();
		// #endif

		// #ifdef APP
		// APP 使用系统分享
		uni.share({
			provider: 'weixin',
			type: 2, // 图片
			imageUrl: filePath,
			success: () => {
				resolve();
			},
			fail: (err) => {
				reject(err);
			}
		});
		// #endif
	});
}
