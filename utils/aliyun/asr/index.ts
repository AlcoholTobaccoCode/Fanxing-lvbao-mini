// 阿里云一句话识别（ASR）封装 - 微信小程序
// 说明：
// - 基于官方文档中的 SpeechRecognition 类
// - 依赖项目已有的 getValidVoiceToken（与 TTS 共用 Token）
// - 录音管理（wx.getRecorderManager）由页面层负责，本工具只负责识别连接与事件绑定

// 声明全局 SpeechRecognition（需要你按阿里云文档引入 sr.js 或对应 SDK）
// 例如：在小程序环境下通过 <script> 或本地模块暴露 SpeechRecognition 到全局
declare const SpeechRecognition: any;

import "./sr.js";
import { getValidVoiceToken, APP_KEY as TTS_APP_KEY } from "../tts";

// 默认服务 URL，可按控制台地域调整
// 参考文档：https://help.aliyun.com/zh/isi/developer-reference/wechat-mini-program-2
export const ASR_SERVICE_URL = "wss://nls-gateway-cn-shanghai.aliyuncs.com/ws/v1";

// 默认使用与 TTS 相同的 APP_KEY，如有需要可单独配置
export const ASR_APP_KEY = TTS_APP_KEY;

export type AsrEventName = "started" | "changed" | "completed" | "closed" | "failed";

export interface AsrEventHandlers {
	onStarted?: (msg: string) => void;
	onChanged?: (msg: string) => void;
	onCompleted?: (msg: string) => void;
	onClosed?: () => void;
	onFailed?: (msg: string) => void;
}

export interface AsrStartParams {
	format?: string; // 默认 "pcm"
	sample_rate?: number; // 默认 16000
	enable_intermediate_result?: boolean;
	enable_punctuation_prediction?: boolean;
	enable_inverse_text_normalization?: boolean;
	// 其余参数透传给阿里云，如：enable_voice_detection 等
	[key: string]: any;
}

export interface AsrRecognizerOptions {
	/** 可选覆盖服务 URL */
	url?: string;
	/** 可选覆盖 APP KEY */
	appKey?: string;
	/** 若你已有独立获取的阿里云 access token，可直接传入；不传则使用 getValidVoiceToken() */
	token?: string;
}

export interface AsrRecognizer {
	/**
	 * 开始识别：
	 * - 内部会在第一次调用时自动使用 defaultStartParams() 合并你的参数
	 * - Promise resolve 表示 started 事件已触发
	 */
	start: (params?: Partial<AsrStartParams>) => Promise<void>;

	/**
	 * 结束当前一句话识别：
	 * - 会等待 completed 事件后 resolve
	 */
	close: () => Promise<void>;

	/** 强制断开连接，一般在页面 onUnload 中调用 */
	shutdown: () => void;

	/** 发送音频帧，需使用与 start 参数一致的 format / sample_rate */
	sendAudio: (data: ArrayBuffer) => void;

	/** 暴露底层实例以便调试或扩展 */
	raw: any;
}

const getSpeechRecognitionCtor = (): any => {
	const g: any =
		typeof globalThis !== "undefined"
			? globalThis
			: typeof window !== "undefined"
				? (window as any)
				: typeof global !== "undefined"
					? (global as any)
					: {};
	return (
		g.SpeechRecognition || (typeof SpeechRecognition !== "undefined" ? SpeechRecognition : null)
	);
};

/**
 * 创建一个阿里云一句话识别实例（微信小程序环境）：
 * - 自动获取并缓存 Token（复用 TTS 的 getValidVoiceToken）
 * - 帮你绑定 started/changed/completed/closed/failed 事件
 * - 页面层只需：
 *   1. await recognizer.start()
 *   2. 在 wx.getRecorderManager().onFrameRecorded 回调中调用 recognizer.sendAudio(frameBuffer)
 *   3. 录音结束后 await recognizer.close()
 */
export const createAsrRecognizer = async (
	handlers: AsrEventHandlers = {},
	options: AsrRecognizerOptions = {}
): Promise<AsrRecognizer> => {
	const SR = getSpeechRecognitionCtor();
	if (!SR) {
		throw new Error(
			"SpeechRecognition 未定义，请先按阿里云文档引入 sr.js 或相关 SDK 并暴露全局变量。"
		);
	}

	const token = options.token ?? (await getValidVoiceToken()).token;

	const url = options.url ?? ASR_SERVICE_URL;
	const appkey = options.appKey ?? ASR_APP_KEY;

	const sr = new SR({
		url,
		appkey,
		token
	});

	// 绑定事件回调
	if (handlers.onStarted) sr.on("started", handlers.onStarted);
	if (handlers.onChanged) sr.on("changed", handlers.onChanged);
	if (handlers.onCompleted) sr.on("completed", handlers.onCompleted);
	if (handlers.onClosed) sr.on("closed", handlers.onClosed);
	if (handlers.onFailed) sr.on("failed", handlers.onFailed);

	// 默认参数（来自 defaultStartParams），缺失时给一个安全兜底
	const baseParams: AsrStartParams = (typeof sr.defaultStartParams === "function" &&
		sr.defaultStartParams()) || {
		format: "pcm",
		sample_rate: 16000,
		enable_intermediate_result: true,
		enable_punctuation_prediction: true,
		enable_inverse_text_normalization: true
	};

	const start = async (params?: Partial<AsrStartParams>) => {
		const merged = {
			...baseParams,
			...(params || {})
		} as AsrStartParams;

		await sr.start(merged);
	};

	const close = async () => {
		// 一般无需携带额外参数，保留扩展位
		await sr.close({});
	};

	const shutdown = () => {
		if (typeof sr.shutdown === "function") {
			sr.shutdown();
		}
	};

	const sendAudio = (data: ArrayBuffer) => {
		sr.sendAudio(data);
	};

	return {
		start,
		close,
		shutdown,
		sendAudio,
		raw: sr
	};
};

export interface AsrOnceOptions extends AsrRecognizerOptions {
	startParams?: Partial<AsrStartParams>;
}

export const recognizeOnceFromBuffer = async (
	buffer: ArrayBuffer,
	options: AsrOnceOptions = {}
): Promise<string> => {
	let finalText = "";
	const parseText = (msg: any) => {
		if (!msg) return "";
		let data = msg;
		if (typeof msg === "string") {
			try {
				data = JSON.parse(msg);
			} catch {
				return msg;
			}
		}
		if (typeof data !== "object") return "";
		const anyData = data as any;
		return (
			anyData.result ||
			anyData.text ||
			anyData.payload?.result ||
			anyData.payload?.text ||
			anyData.payload?.result?.text ||
			""
		);
	};

	return new Promise<string>(async (resolve, reject) => {
		let recognizer: AsrRecognizer | null = null;
		try {
			recognizer = await createAsrRecognizer(
				{
					onChanged: (msg) => {
						const t = parseText(msg);
						if (t) {
							finalText = t;
						}
					},
					onCompleted: (msg) => {
						const t = parseText(msg);
						if (t) {
							finalText = t;
						}
						resolve(finalText);
					},
					onFailed: (msg) => {
						const t = typeof msg === "string" ? msg : JSON.stringify(msg);
						reject(new Error(t || "ASR failed"));
					}
				},
				options
			);
			const startParams: Partial<AsrStartParams> = {
				...(options.startParams || {})
			};
			if (!startParams.format) {
				startParams.format = "mp3";
			}
			if (!startParams.sample_rate) {
				startParams.sample_rate = 16000;
			}
			await recognizer.start(startParams);
			recognizer.sendAudio(buffer);
			await recognizer.close();
			if (!finalText) {
				resolve("");
			}
		} catch (err: any) {
			if (recognizer) {
				recognizer.shutdown();
			}
			reject(err);
		}
	});
};

const readFileAsArrayBuffer = (filePath: string): Promise<ArrayBuffer> => {
	return new Promise((resolve, reject) => {
		const fs = (uni as any).getFileSystemManager?.();
		if (!fs) {
			reject(new Error("当前环境不支持文件读取"));
			return;
		}
		fs.readFile({
			filePath,
			success: (res: any) => {
				resolve(res.data as ArrayBuffer);
			},
			fail: (err: any) => {
				reject(err);
			}
		});
	});
};

export const recognizeOnceFromFile = async (
	filePath: string,
	options: AsrOnceOptions = {}
): Promise<string> => {
	if (!filePath) return "";
	const buffer = await readFileAsArrayBuffer(filePath);
	return recognizeOnceFromBuffer(buffer, options);
};

export const recognizeOnceFromUrl = async (
	url: string,
	options: AsrOnceOptions = {}
): Promise<string> => {
	if (!url) return "";
	const tempFile = await new Promise<string>((resolve, reject) => {
		uni.downloadFile({
			url,
			success: (res) => {
				const anyRes = res as any;
				if (anyRes.statusCode === 200 && anyRes.tempFilePath) {
					resolve(anyRes.tempFilePath as string);
				} else {
					reject(new Error("下载音频失败"));
				}
			},
			fail: (err) => {
				reject(err as any);
			}
		});
	});
	return recognizeOnceFromFile(tempFile, options);
};
