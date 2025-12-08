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

export const normalize = (v?: string | null) => (v && v !== "null" ? v : undefined);
