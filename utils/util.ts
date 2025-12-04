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
