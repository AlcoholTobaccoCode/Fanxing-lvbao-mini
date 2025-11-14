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
