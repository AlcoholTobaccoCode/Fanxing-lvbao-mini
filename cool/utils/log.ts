import { isDev } from "@/config";

/**
 * 轻量日志工具
 * - 可选模块名，用于区分不同模块的输出
 * - 支持 group / groupEnd，将同一批日志收拢在一个分组下
 * - 仅在开发环境输出（通过 config.isDev 控制）
 */
export class Logger {
	private module: string;

	constructor(moduleName?: string) {
		this.module = moduleName || "default";
	}

	// 内部统一前缀
	private prefix() {
		return `[${this.module}]`;
	}

	private canLog() {
		return isDev;
	}

	group(label?: string) {
		if (!this.canLog()) return;
		const title = label ? `${this.prefix()} ${label}` : this.prefix();
		console.group(title);
	}

	groupEnd() {
		if (!this.canLog()) return;
		console.groupEnd();
	}

	log(...args: any[]) {
		if (!this.canLog()) return;
		console.log(this.prefix(), ...args);
	}

	info(...args: any[]) {
		if (!this.canLog()) return;
		console.info(this.prefix(), ...args);
	}

	warn(...args: any[]) {
		if (!this.canLog()) return;
		console.warn(this.prefix(), ...args);
	}

	error(...args: any[]) {
		if (!this.canLog()) return;
		console.error(this.prefix(), ...args);
	}

	/**
	 * AI 辅助错误分析
	 * - 自动调用流式接口获取错误修复方案
	 * - 使用 console.group 分组展示分析过程
	 * - 支持流式更新，显示思考/总结等状态
	 */
	async errorAi(error: any, context?: Record<string, any>) {
		if (!this.canLog()) return;

		// 首先打印原始错误
		console.error(this.prefix(), error);

		// 开启分组
		const groupLabel = "🤖 AI 修复建议";
		console.group(`${this.prefix()} ${groupLabel}`);

		try {
			// 构建错误信息
			const errorMessage =
				error instanceof Error
					? `${error.name}: ${error.message}\n${error.stack || ""}`
					: String(error);

			const contextInfo = context
				? `\n\n上下文信息：\n${JSON.stringify(context, null, 2)}`
				: "";

			const fullPrompt = `你是一个专业的前端开发助手。以下是遇到的错误信息，请分析错误原因并给出可能的修复方案：
				错误信息：
				${errorMessage}${contextInfo}
				请给出：
				1. 错误原因分析
				2. 可能的修复方案（按优先级排序）
				3. 预防措施`;

			// 显示初始状态
			console.log("💭 正在分析错误...");

			// 调用流式接口
			await this.callStreamAPI(fullPrompt);
		} catch (err) {
			console.error("❌ AI 分析失败:", err);
		} finally {
			// 结束分组
			console.groupEnd();
		}
	}

	/**
	 * 调用流式 API
	 */
	private async callStreamAPI(prompt: string) {
		// 动态导入配置，避免循环依赖
		const { config } = await import("@/config");

		// 获取 token（如果需要）
		let token = "";
		try {
			// 尝试从 uni.getStorageSync 获取 token
			// @ts-ignore
			if (typeof uni !== "undefined" && uni.getStorageSync) {
				// @ts-ignore
				token = uni.getStorageSync("token") || "";
			} else if (typeof localStorage !== "undefined") {
				token = localStorage.getItem("token") || "";
			}
		} catch {
			// 忽略获取 token 的错误
		}

		const url = `${config.baseUrl}/law/summary`;

		// 检查是否支持 fetch 和流式响应
		if (typeof fetch === "undefined") {
			console.warn("⚠️ 当前环境不支持 fetch API，无法进行 AI 分析");
			return;
		}

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {})
				},
				body: JSON.stringify({ content: prompt })
			});

			if (!response.ok || !response.body) {
				console.error("❌ 接口请求失败:", response.status, response.statusText);
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder("utf-8");
			let buffer = "";
			let lastText = "";
			let isFirstChunk = true;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const rawLine of lines) {
					const line = rawLine.trim();
					if (!line.startsWith("data:")) continue;

					const jsonStr = line.replace(/^data:\s*/, "").trim();
					if (!jsonStr) continue;

					try {
						const parsed = JSON.parse(jsonStr);
						let text = parsed.text as string;

						if (!text) continue;

						// 处理转义的换行符
						text = text.replace(/\\n/g, "\n");

						// 如果是第一个有内容的数据块，清除"正在分析"的提示
						if (isFirstChunk && text.trim()) {
							console.clear();
							console.log("✨ AI 分析结果：\n");
							isFirstChunk = false;
						}

						// 只有当文本有实质变化时才更新
						if (text !== lastText && text.trim()) {
							// 清除之前的内容，重新打印（模拟流式更新效果）
							if (lastText) {
								console.clear();
								console.log("✨ AI 分析结果：\n");
							}

							// 处理 markdown 格式，保持换行
							const formattedText = this.formatMarkdown(text);
							console.log(formattedText);

							lastText = text;
						}

						// 检查是否完成
						if (parsed.finishReason === "stop") {
							console.log("\n\n✅ 分析完成");
							break;
						}
					} catch (e) {
						// 忽略 JSON 解析错误
					}
				}
			}
		} catch (err) {
			throw err;
		}
	}

	/**
	 * 格式化 Markdown 文本（保持换行和基本格式）
	 */
	private formatMarkdown(text: string): string {
		// 保持原有的换行
		return text
			.split("\n")
			.map((line) => {
				// 为标题添加样式（使用 console 支持的格式）
				if (line.startsWith("###")) {
					return `\n${line}`;
				}
				if (line.startsWith("##")) {
					return `\n${line}`;
				}
				if (line.startsWith("#")) {
					return `\n${line}`;
				}
				return line;
			})
			.join("\n");
	}

	debug(...args: any[]) {
		if (!this.canLog()) return;
		if (typeof console.debug === "function") {
			console.debug(this.prefix(), ...args);
		} else {
			console.log(this.prefix(), ...args);
		}
	}
}

/**
 * 工厂方法，便于按需创建实例
 */
export function createLogger(moduleName?: string) {
	return new Logger(moduleName);
}
