/**
 * SSE 流式解码器
 *
 * 解决 UTF-8 多字节字符跨 chunk 被截断导致的乱码问题
 * 使用 TextDecoder 的 stream 模式进行增量解码
 */
export class SseDecoder {
	private decoder: TextDecoder | null = null;
	private pendingBytes: number[] = [];

	constructor() {
		this.init();
	}

	/**
	 * 初始化解码器
	 */
	init() {
		if (typeof TextDecoder !== "undefined") {
			this.decoder = new TextDecoder("utf-8");
		} else {
			this.decoder = null;
		}
		this.pendingBytes = [];
	}

	/**
	 * 解码 ArrayBuffer 数据
	 * @param data ArrayBuffer 数据
	 * @returns 解码后的字符串
	 */
	decode(data: ArrayBuffer): string {
		if (this.decoder) {
			// 使用 stream: true 保持解码状态，处理跨 chunk 的多字节字符
			return this.decoder.decode(new Uint8Array(data), { stream: true });
		}

		// 回退方案：手动处理 UTF-8 多字节字符
		return this.fallbackDecode(new Uint8Array(data));
	}

	/**
	 * 刷新解码器，获取剩余的字节
	 * 在流结束时调用
	 * @returns 剩余的字符串
	 */
	flush(): string {
		if (this.decoder) {
			// 不传参数调用 decode() 会 flush 内部缓冲区
			const remaining = this.decoder.decode();
			this.init(); // 重置状态
			return remaining;
		}

		// 回退方案：处理剩余的不完整字节
		const remaining = this.flushPendingBytes();
		this.pendingBytes = [];
		return remaining;
	}

	/**
	 * 重置解码器状态
	 */
	reset() {
		this.init();
	}

	/**
	 * 回退方案：手动处理 UTF-8 解码
	 * 支持跨 chunk 的多字节字符
	 */
	private fallbackDecode(uint8: Uint8Array): string {
		let result = "";

		// 将新数据追加到待处理字节数组
		for (let i = 0; i < uint8.length; i++) {
			this.pendingBytes.push(uint8[i]);
		}

		// 尝试解码完整的 UTF-8 字符
		let i = 0;
		while (i < this.pendingBytes.length) {
			const byte = this.pendingBytes[i];
			let charLen = 1;
			let codePoint = 0;

			// 判断 UTF-8 字符长度
			if ((byte & 0x80) === 0) {
				// 单字节 ASCII (0xxxxxxx)
				charLen = 1;
				codePoint = byte;
			} else if ((byte & 0xe0) === 0xc0) {
				// 双字节 (110xxxxx)
				charLen = 2;
				codePoint = byte & 0x1f;
			} else if ((byte & 0xf0) === 0xe0) {
				// 三字节 (1110xxxx) - 常见中文
				charLen = 3;
				codePoint = byte & 0x0f;
			} else if ((byte & 0xf8) === 0xf0) {
				// 四字节 (11110xxx) - emoji 等
				charLen = 4;
				codePoint = byte & 0x07;
			} else {
				// 无效的 UTF-8 起始字节，跳过
				i++;
				continue;
			}

			// 检查是否有足够的字节
			if (i + charLen > this.pendingBytes.length) {
				// 字节不完整，等待下一个 chunk
				break;
			}

			// 解码多字节字符
			let valid = true;
			for (let j = 1; j < charLen; j++) {
				const nextByte = this.pendingBytes[i + j];
				// 续字节必须是 10xxxxxx 格式
				if ((nextByte & 0xc0) !== 0x80) {
					valid = false;
					break;
				}
				codePoint = (codePoint << 6) | (nextByte & 0x3f);
			}

			if (valid) {
				result += String.fromCodePoint(codePoint);
				i += charLen;
			} else {
				// 无效序列，跳过第一个字节
				i++;
			}
		}

		// 保留未解码的字节（可能是不完整的多字节字符）
		this.pendingBytes = this.pendingBytes.slice(i);

		return result;
	}

	/**
	 * 处理剩余的不完整字节（流结束时）
	 */
	private flushPendingBytes(): string {
		if (this.pendingBytes.length === 0) {
			return "";
		}

		// 尝试用替换字符处理剩余的不完整字节
		// 这些是被截断的不完整 UTF-8 序列
		let result = "";
		for (const byte of this.pendingBytes) {
			// 对于无法解码的字节，使用替换字符
			if (byte < 0x80) {
				result += String.fromCharCode(byte);
			}
			// 其他字节是不完整的多字节序列的一部分，丢弃
		}
		return result;
	}
}

/**
 * 创建 SSE 解码器实例
 */
export function createSseDecoder(): SseDecoder {
	return new SseDecoder();
}
