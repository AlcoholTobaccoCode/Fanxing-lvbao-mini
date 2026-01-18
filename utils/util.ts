/**
 * 将字符串数组按指定大小切分为多个子数组
 * @param arr 原数组
 * @param size 按 size 数量分割
 */
export type chunkArrayType = Array<Array<string>>;
export const chunkArray = (arr: Array<string>, size: number): chunkArrayType => {
	const res: Array<string[]> = [];
	for (let i = 0; i < arr.length; i += size) {
		const chunk = arr.slice(i, i + size);
		res.push(chunk);
	}
	return res;
};

/**
 * 生成随机len位数字
 * @param len 指定位数，默认 4
 * @param date 是否添加时间戳
 */
export const randomLenNum = (len, date) => {
	let random = Math.ceil(Math.random() * 100000000000000)
		.toString()
		.slice(0, len || 4);
	if (date) random = random + Date.now();
	return random;
};

// 生成UUID
export const generateUUID = (): string => {
	let d = new Date().getTime();
	const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		const r = (d + Math.random() * 16) % 16 | 0;
		d = Math.floor(d / 16);
		return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
	});
	return uuid;
};

/**
 * 生成指定长度的随机字符串
 * @param len - 字符串长度（必须 ≥ 1）
 * @param charset - 可选：自定义字符集，默认为字母（大小写）+ 数字
 * @returns 随机字符串
 */
export const generateRandomString = (
	len: number = 1,
	charset: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
): string => {
	if (len <= 0) {
		throw new Error("随机字符串长度必须为至少 1 位的整数.");
	}
	if (charset.length === 0) {
		throw new Error("Charset 不能为空.");
	}

	let result = "";
	for (let i = 0; i < len; i++) {
		const randomIndex = Math.floor(Math.random() * charset.length);
		result += charset[randomIndex];
	}
	return result;
};

/**
 * 生成 [min, max] 范围内的随机整数（含两端）
 * @param min 最小数
 * @param max 最大数
 */
export const getRandomInt = (min: number = 0, max: number = 1): number => {
	if (min > max) [min, max] = [max, min];
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * 生成 [min, max) 范围内的随机浮点数（含 min，不含 max）
 * @param min 最小数
 * @param max 最大数
 * @param fixed 可选保留小数位数
 */
export const getRandomFloat = (min: number = 0, max: number = 1, fixed?: number): number => {
	if (min > max) [min, max] = [max, min];
	let result = Math.random() * (max - min) + min;
	if (fixed != null) {
		result = parseFloat(result.toFixed(fixed));
	}
	return result;
};

// 空判断
export const normalize = (v?: string | null) => (v && v !== "null" ? v : undefined);

/**
 * @description: 图片压缩
 * @param {string} fileUrl 文件临时地址
 * @param {object} compress 是否压缩: { openSize: x(m), radio(压缩比): 0 < x <= 1 }
 * 	- openSize(可选) 压缩触发大小, 权重低于 open
 * 	- radio(可选) 压缩比率, 默认 0.8, 超过 1 小于 0 使用默认
 * @return {string} url
 */
export interface CompressOptions {
	fileUrl: string;
	compress?: {
		openSize?: number; // 单位：MB，超过此大小才压缩
		radio?: number; // 压缩质量 1~100，或 0~1（自动归一化为 80）
	};
}

export const compressImage = (options: CompressOptions): Promise<string | null> => {
	return new Promise((resolve, reject) => {
		if (!options?.fileUrl) {
			resolve(null);
			return;
		}

		let radio = +(options.compress?.radio ?? 80);
		if (isNaN(radio) || radio > 100 || radio <= 0) {
			radio = 80;
		}
		// 确保 radio 是 1~100 范围（uni.compressImage 要求）
		radio = Math.min(100, Math.max(1, radio));

		// #ifndef H5
		uni.getFileInfo({
			filePath: options.fileUrl,
			success: (imageInfoRes) => {
				const sizeInMB = imageInfoRes.size / 1024 / 1024;
				const openSize = options.compress?.openSize;

				if (!openSize || sizeInMB >= openSize) {
					// 需要压缩
					uni.compressImage({
						src: options.fileUrl,
						quality: radio, // 1~100
						success: (compressRes) => {
							resolve(compressRes.tempFilePath);
						},
						fail: () => {
							resolve(options.fileUrl); // 压缩失败，返回原图
						}
					});
				} else {
					resolve(options.fileUrl); // 不需要压缩
				}
			},
			fail: () => {
				resolve(options.fileUrl); // 获取文件信息失败，返回原图
			}
		});
		// #endif

		// #ifdef H5
		const img = new Image();
		img.src = options.fileUrl;

		img.onload = () => {
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				resolve(options.fileUrl);
				return;
			}

			let { width: cw, height: ch } = img;
			let w = cw;
			let h = ch;

			// 最大边不超过 600px
			if (cw > 600 || ch > 600) {
				if (cw > ch) {
					w = 600;
					h = (600 * ch) / cw;
				} else {
					h = 600;
					w = (600 * cw) / ch;
				}
			}

			canvas.width = w;
			canvas.height = h;
			ctx.clearRect(0, 0, w, h);
			ctx.drawImage(img, 0, 0, w, h);

			// 注意：radio 是 1~100，toDataURL 第二个参数是 0~1
			const base64 = canvas.toDataURL("image/jpeg", radio / 100);
			resolve(base64);
		};

		img.onerror = () => {
			resolve(options.fileUrl);
		};
		// #endif
	});
};

export const sleepWait = (ms: number = 100) => {
	return new Promise((r) => setTimeout(r, ms));
};
