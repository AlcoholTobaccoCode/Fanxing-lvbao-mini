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
