// 阿里云实时语音识别（Real-time ASR）封装 - 微信小程序
// 文档：https://help.aliyun.com/zh/isi/developer-reference/wechat-mini-program

// 仅在小程序环境有效
declare const wx: any;

import { getValidVoiceToken, APP_KEY as ASR_APP_KEY } from "../tts";
import { Logger } from "@/cool/utils/log";

export type AsrStreamFormat = "pcm" | "opus" | "opu";

export interface AsrStreamOptions {
	appKey?: string;
	token?: string;
	region?: string; // 默认 cn-shanghai
	format?: AsrStreamFormat; // 默认 pcm
	sampleRate?: number; // 默认 16000
	enableIntermediateResult?: boolean; // 是否返回中间结果，默认 true
	enablePunctuationPrediction?: boolean; // 标点预测，默认 true
	enableInverseTextNormalization?: boolean; // 数字转换，默认 true
	maxSentenceSilence?: number; // 句子最大静音时长（毫秒），默认 800
	enableVoiceDetection?: boolean; // 是否启用语音检测，默认 false
}

export interface AsrStreamHandlers {
	/** 识别开始 */
	onStarted?: (evt: any) => void;
	/** 句子开始 */
	onSentenceBegin?: (evt: any) => void;
	/** 识别结果变化（中间结果和最终结果都会触发） */
	onResultChanged?: (result: string, isFinal: boolean, evt: any) => void;
	/** 句子结束（返回完整句子） */
	onSentenceEnd?: (result: string, evt: any) => void;
	/** 识别完成 */
	onCompleted?: (evt: any) => void;
	/** 识别失败 */
	onFailed?: (err: any) => void;
}

export interface AsrStreamSession {
	/**
	 * 发送音频数据
	 * @param audioData PCM/Opus 音频数据
	 */
	sendAudio: (audioData: ArrayBuffer) => Promise<void>;
	/**
	 * 停止识别
	 */
	stop: () => Promise<void>;
	/**
	 * 强制关闭连接
	 */
	close: () => void;
	/** 方便调试：暴露底层 socketTask */
	raw: any;
}

const TRANSCRIPTION_NAMESPACE = "SpeechTranscriber";

const log = new Logger("RealtimeVoiceInput");

const randomHex32 = (): string => {
	const bytes = new Uint8Array(16);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Math.floor(Math.random() * 256);
	}
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
};

const buildHeader = (taskId: string, name: string, appKey: string) => {
	return {
		message_id: randomHex32(),
		task_id: taskId,
		namespace: TRANSCRIPTION_NAMESPACE,
		name,
		appkey: appKey
	};
};

const buildContext = () => ({
	sdk: {
		name: "nls-wx-sdk",
		version: "0.0.1",
		language: "wxjs"
	}
});

/**
 * 创建实时语音识别会话
 * @param options 配置选项
 * @param handlers 事件处理器
 * @returns AsrStreamSession
 */
export const createAsrStream = async (
	options: AsrStreamOptions = {},
	handlers: AsrStreamHandlers = {}
): Promise<AsrStreamSession> => {
	if (typeof wx === "undefined" || !wx || !wx.connectSocket) {
		throw new Error("createAsrStream 仅支持在微信小程序环境中使用");
	}

	const region = options.region || "cn-shanghai";
	const appKey = options.appKey || ASR_APP_KEY;
	const token = options.token || (await getValidVoiceToken()).token;
	const format: AsrStreamFormat = options.format || "pcm";
	const sampleRate = options.sampleRate ?? 16000;
	const enableIntermediateResult = options.enableIntermediateResult ?? true;
	const enablePunctuationPrediction = options.enablePunctuationPrediction ?? true;
	const enableInverseTextNormalization = options.enableInverseTextNormalization ?? true;
	const maxSentenceSilence = options.maxSentenceSilence ?? 800;
	const enableVoiceDetection = options.enableVoiceDetection ?? false;

	// 实时语音识别的 URL 格式（与一句话识别相同）
	// 参考官方示例：wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1
	const wsUrl = `wss://nls-gateway.${region}.aliyuncs.com/ws/v1`;
	const taskId = randomHex32();

	let socketTask: any = null;
	let started = false;
	let closed = false;

	// 用于等待 TranscriptionStarted 响应
	let startResolve: ((value: void) => void) | null = null;
	let startReject: ((reason: any) => void) | null = null;

	// 建立连接
	socketTask = wx.connectSocket({
		url: wsUrl,
		tcpNoDelay: true,
		header: {
			"X-NLS-Token": token
		}
	});

	log.debug("[ASR-Stream] 开始建立 WebSocket 连接...");

	// 监听消息
	socketTask.onMessage((res: { data: string | ArrayBuffer }) => {
		// 实时识别只返回 JSON 文本消息，不会返回二进制音频
		log.debug("[ASR-Stream] 收到原始消息:", typeof res.data, res.data);

		if (typeof res.data === "string") {
			try {
				const msg = JSON.parse(res.data as string);
				const name = msg?.header?.name as string | undefined;

				log.debug("[ASR-Stream] 解析后的消息:", JSON.stringify(msg, null, 2));

				if (!name) {
					log.warn("[ASR-Stream] 消息中没有 name 字段");
					return;
				}

				log.debug("[ASR-Stream] 收到事件:", name);

				if (name === "TranscriptionStarted") {
					log.debug("[ASR-Stream] 识别已启动");
					started = true;
					handlers.onStarted?.(msg);
					// 收到 TranscriptionStarted 后才 resolve start Promise
					startResolve?.();
				} else if (name === "SentenceBegin") {
					log.debug("[ASR-Stream] 句子开始");
					handlers.onSentenceBegin?.(msg);
				} else if (name === "TranscriptionResultChanged") {
					// 解析识别结果
					log.debug(
						"[ASR-Stream] TranscriptionResultChanged 完整消息:",
						JSON.stringify(msg)
					);
					const result = msg?.payload?.result || "";
					const status = msg?.payload?.status || 0;
					const isFinal = status === 1; // status: 0=临时结果, 1=最终结果
					log.debug("[ASR-Stream] 解析结果:", { result, status, isFinal });
					handlers.onResultChanged?.(result, isFinal, msg);
				} else if (name === "SentenceEnd") {
					log.debug("[ASR-Stream] 句子结束");
					const result = msg?.payload?.result || "";
					handlers.onSentenceEnd?.(result, msg);
				} else if (name === "TranscriptionCompleted") {
					log.debug("[ASR-Stream] 识别完成");
					handlers.onCompleted?.(msg);
				} else if (name === "TaskFailed") {
					log.error("[ASR-Stream] TaskFailed", msg);
					handlers.onFailed?.(msg);
					// TaskFailed 也要 reject start Promise
					startReject?.(msg);
				} else {
					log.warn("[ASR-Stream] 未知事件类型:", name);
				}
			} catch (e) {
				log.warn("[ASR-Stream] 解析消息失败", res.data, e);
			}
		} else {
			log.warn("[ASR-Stream] 收到非字符串消息（二进制？）", res.data);
		}
	});

	socketTask.onError((err: any) => {
		log.error("[ASR-Stream] WebSocket 错误", err);
		if (!closed) {
			handlers.onFailed?.(err);
		}
	});

	socketTask.onClose((e: any) => {
		log.debug("[ASR-Stream] WebSocket 已关闭", e);
		closed = true;
	});

	// 等待连接打开并发送 StartTranscription，然后等待 TranscriptionStarted 响应
	await new Promise<void>((resolve, reject) => {
		// 保存 resolve 和 reject，在收到 TranscriptionStarted 时调用
		startResolve = resolve;
		startReject = reject;

		socketTask.onOpen(() => {
			log.debug("[ASR-Stream] WebSocket 连接已打开");
			const startMsg = {
				header: buildHeader(taskId, "StartTranscription", appKey),
				payload: {
					format,
					sample_rate: sampleRate,
					enable_intermediate_result: enableIntermediateResult,
					enable_punctuation_prediction: enablePunctuationPrediction,
					enable_inverse_text_normalization: enableInverseTextNormalization,
					max_sentence_silence: maxSentenceSilence,
					enable_voice_detection: enableVoiceDetection
				},
				context: buildContext()
			};
			try {
				const startMsgStr = JSON.stringify(startMsg);
				log.debug("[ASR-Stream] 发送 StartTranscription 指令:", startMsgStr);
				socketTask.send({ data: startMsgStr });
				// 不在这里 resolve，等待收到 TranscriptionStarted 响应
			} catch (e) {
				reject(e);
			}
		});
		socketTask.onError((err: any) => {
			log.error("[ASR-Stream] WebSocket 打开失败", err);
			reject(err);
		});
	});

	const ensureStarted = () => {
		if (!started || closed) {
			throw new Error("ASR 实时识别会话尚未就绪或已关闭");
		}
	};

	const sendAudio = async (audioData: ArrayBuffer) => {
		ensureStarted();
		return new Promise<void>((resolve, reject) => {
			try {
				socketTask.send({ data: audioData });
				resolve();
			} catch (e) {
				reject(e);
			}
		});
	};

	const stop = async () => {
		ensureStarted();
		const msg = {
			header: buildHeader(taskId, "StopTranscription", appKey),
			payload: {}, // 空对象
			context: buildContext()
		};
		const msgStr = JSON.stringify(msg);
		log.debug("[ASR-Stream] 发送 StopTranscription 指令:", msgStr);

		// 等待 TranscriptionCompleted 响应
		return new Promise<void>((resolve, reject) => {
			// 设置一个临时的 completed 监听器
			const originalOnCompleted = handlers.onCompleted;
			const timeoutId = setTimeout(() => {
				log.warn("[ASR-Stream] 等待 TranscriptionCompleted 超时（5秒）");
				handlers.onCompleted = originalOnCompleted;
				resolve(); // 超时也 resolve，避免卡住
			}, 5000);

			handlers.onCompleted = (evt) => {
				clearTimeout(timeoutId);
				log.debug("[ASR-Stream] 收到 TranscriptionCompleted，stop 完成");
				handlers.onCompleted = originalOnCompleted;
				originalOnCompleted?.(evt);
				resolve();
			};

			try {
				socketTask.send({ data: msgStr });
			} catch (e) {
				clearTimeout(timeoutId);
				handlers.onCompleted = originalOnCompleted;
				reject(e);
			}
		});
	};

	const close = () => {
		if (closed) return;
		closed = true;
		try {
			socketTask.close();
		} catch (e) {
			// ignore
		}
	};

	return {
		sendAudio,
		stop,
		close,
		raw: socketTask
	};
};
