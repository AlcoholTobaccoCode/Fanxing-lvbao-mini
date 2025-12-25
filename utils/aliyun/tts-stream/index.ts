// 阿里云流式文本语音合成（FlowingSpeechSynthesizer）封装 - 微信小程序
// 文档：https://help.aliyun.com/zh/isi/developer-reference/streaming-text-tts-wss

// 仅在小程序环境有效
declare const wx: any;

import { getValidVoiceToken, APP_KEY as TTS_APP_KEY } from "../tts";

export type TtsStreamFormat = "pcm" | "wav" | "mp3";

export interface TtsStreamOptions {
	appKey?: string;
	token?: string;
	region?: string; // 默认 cn-shanghai
	voice?: string; // 默认 xiaoyun
	format?: TtsStreamFormat; // 默认 pcm
	sampleRate?: number; // 默认 16000
	volume?: number; // 0-100，默认 50
	speechRate?: number; // -500~500，默认 0
	pitchRate?: number; // -500~500，默认 0
	enableSubtitle?: boolean;
	enablePhonemeTimestamp?: boolean;
}

export interface TtsStreamHandlers {
	onStarted?: (evt: any) => void;
	onSentenceBegin?: (evt: any) => void;
	onSentenceSynthesis?: (evt: any) => void;
	onSentenceEnd?: (evt: any) => void;
	onCompleted?: (evt: any) => void;
	onFailed?: (err: any) => void;
	/** 下行音频流 chunk（完整音频按顺序拼接即可） */
	onAudioChunk?: (chunk: ArrayBuffer) => void;
}

export interface TtsStreamSession {
	/**
	 * 追加一段需要合成的文本（对应 RunSynthesis 指令）
	 */
	run: (text: string) => Promise<void>;
	/**
	 * 结束本次流式合成，通知服务端 flush 缓存文本（对应 StopSynthesis 指令）
	 */
	stop: () => Promise<void>;
	/**
	 * 强制关闭当前会话（不保证完整音频）
	 */
	close: () => void;
	/** 方便调试：暴露底层 socketTask */
	raw: any;
}

const FLOWING_NAMESPACE = "FlowingSpeechSynthesizer";

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
		namespace: FLOWING_NAMESPACE,
		name,
		appkey: appKey
	};
};

export interface ConsultTtsController {
	feedText: (chunk: string) => Promise<void>;
	finish: () => Promise<void>;
	dispose: () => void;
}

/**
 * TODO
 * 流式 TTS 控制器封装
 * - 内部使用 createTtsStream
 * - 持续接收音频 chunk
 * - 在完成或 IdleTimeout(TaskFailed 40000004) 时合并为 mp3 并自动播放
 */
export const createConsultTtsController = async (): Promise<ConsultTtsController> => {
	// 非微信环境返回空实现，避免调用报错
	if (typeof wx === "undefined" || !wx || !wx.connectSocket) {
		return {
			feedText: async () => {},
			finish: async () => {},
			dispose: () => {}
		};
	}

	const audioChunks: ArrayBuffer[] = [];
	let stopped = false;
	let finalized = false;

	const finalizeAudio = () => {
		if (finalized) return;
		finalized = true;
		if (!audioChunks.length) return;

		const total = audioChunks.reduce((sum, b) => sum + b.byteLength, 0);
		const merged = new Uint8Array(total);
		let offset = 0;
		for (const chunk of audioChunks) {
			merged.set(new Uint8Array(chunk), offset);
			offset += chunk.byteLength;
		}

		const fs = wx.getFileSystemManager();
		const filePath = `${wx.env.USER_DATA_PATH}/consult_tts_${Date.now()}.mp3`;
		fs.writeFile({
			filePath,
			data: merged.buffer,
			encoding: "binary",
			success: () => {
				try {
					const audio = uni.createInnerAudioContext();
					audio.src = filePath;
					audio.play();
				} catch (e) {
					console.error("[ConsultTTS] 播放失败", e);
				}
			},
			fail: (err: any) => {
				console.error("[ConsultTTS] 写入音频失败", err);
			}
		});
	};

	const session = await createTtsStream(
		{
			format: "mp3",
			sampleRate: 16000
		},
		{
			onCompleted: () => {
				finalizeAudio();
			},
			onFailed: (err) => {
				const status = (err && (err as any).header && (err as any).header.status) || null;
				const statusText =
					(err && (err as any).header && (err as any).header.status_text) || "";
				// IdleTimeout 视为会话自然结束，使用已收到的音频
				if (
					status === 40000004 &&
					typeof statusText === "string" &&
					statusText.indexOf("IDLE_TIMEOUT") >= 0
				) {
					finalizeAudio();
					return;
				}
				console.error("[ConsultTTS] TaskFailed", err);
			},
			onAudioChunk: (chunk) => {
				audioChunks.push(chunk);
			}
		}
	);

	return {
		feedText: async (chunk: string) => {
			if (!chunk || !chunk.trim()) return;
			if (stopped) return;
			await session.run(chunk);
		},
		finish: async () => {
			if (stopped) return;
			stopped = true;
			try {
				await session.stop();
			} catch (e) {
				console.error("[ConsultTTS] stop error", e);
			}
		},
		dispose: () => {
			stopped = true;
			try {
				session.close();
			} catch (e) {
				// ignore
			}
		}
	};
};

const buildContext = () => ({
	sdk: {
		name: "nls-wx-sdk",
		version: "0.0.1",
		language: "wxjs"
	}
});

export const createTtsStream = async (
	options: TtsStreamOptions = {},
	handlers: TtsStreamHandlers = {}
): Promise<TtsStreamSession> => {
	if (typeof wx === "undefined" || !wx || !wx.connectSocket) {
		throw new Error("createTtsStream 仅支持在微信小程序环境中使用");
	}

	const region = options.region || "cn-shanghai";
	const appKey = options.appKey || TTS_APP_KEY;
	const token = options.token || (await getValidVoiceToken()).token;
	const voice = options.voice || "xiaoyun";
	const format: TtsStreamFormat = options.format || "pcm";
	const sampleRate = options.sampleRate ?? 16000;
	const volume = options.volume ?? 50;
	const speechRate = options.speechRate ?? 0;
	const pitchRate = options.pitchRate ?? 0;
	const enableSubtitle = !!options.enableSubtitle;
	const enablePhonemeTimestamp = !!options.enablePhonemeTimestamp;

	const wsUrl = `wss://nls-gateway.${region}.aliyuncs.com/ws/v1`;
	const taskId = randomHex32();

	let socketTask: any = null;
	let started = false;
	let closed = false;

	// 建立连接
	socketTask = wx.connectSocket({
		url: wsUrl,
		tcpNoDelay: true,
		header: {
			"X-NLS-Token": token
		},
		success: () => {
			console.log("[TTS-Stream] WebSocket 连接成功");
		},
		fail: (err: any) => {
			console.error("[TTS-Stream] WebSocket 连接失败", err);
		}
	});

	// 文本事件
	socketTask.onMessage((res: { data: string | ArrayBuffer }) => {
		if (typeof res.data === "string") {
			try {
				const msg = JSON.parse(res.data as string);
				const name = msg?.header?.name as string | undefined;
				if (!name) return;
				if (name === "SynthesisStarted") {
					handlers.onStarted?.(msg);
				} else if (name === "SentenceBegin") {
					handlers.onSentenceBegin?.(msg);
				} else if (name === "SentenceSynthesis") {
					handlers.onSentenceSynthesis?.(msg);
				} else if (name === "SentenceEnd") {
					handlers.onSentenceEnd?.(msg);
				} else if (name === "SynthesisCompleted") {
					handlers.onCompleted?.(msg);
				} else if (name === "TaskFailed") {
					console.error("[TTS-Stream] TaskFailed", msg);
					handlers.onFailed?.(msg);
				}
			} catch (e) {
				console.warn("[TTS-Stream] 非 JSON 文本消息", res.data);
			}
		} else if (res.data instanceof ArrayBuffer) {
			handlers.onAudioChunk?.(res.data);
		}
	});

	socketTask.onError((err: any) => {
		console.error("[TTS-Stream] WebSocket 错误", err);
		if (!closed) {
			handlers.onFailed?.(err);
		}
	});

	socketTask.onClose((e: any) => {
		console.log("[TTS-Stream] WebSocket 已关闭", e);
		closed = true;
	});

	// 等待连接打开并发送 StartSynthesis
	await new Promise<void>((resolve, reject) => {
		socketTask.onOpen(() => {
			const startMsg = {
				header: buildHeader(taskId, "StartSynthesis", appKey),
				payload: {
					voice,
					format,
					sample_rate: sampleRate,
					volume,
					speech_rate: speechRate,
					pitch_rate: pitchRate,
					enable_subtitle: enableSubtitle,
					enable_phoneme_timestamp: enablePhonemeTimestamp
				},
				context: buildContext()
			};
			try {
				socketTask.send({ data: JSON.stringify(startMsg) });
				started = true;
				resolve();
			} catch (e) {
				reject(e);
			}
		});
		socketTask.onError((err: any) => {
			reject(err);
		});
	});

	const ensureStarted = () => {
		if (!started || closed) {
			throw new Error("TTS 流式会话尚未就绪或已关闭");
		}
	};

	const run = async (text: string) => {
		if (!text || !text.trim()) return;
		ensureStarted();
		const msg = {
			header: buildHeader(taskId, "RunSynthesis", appKey),
			payload: { text },
			context: buildContext()
		};
		return new Promise<void>((resolve, reject) => {
			try {
				socketTask.send({ data: JSON.stringify(msg) });
				resolve();
			} catch (e) {
				reject(e);
			}
		});
	};

	const stop = async () => {
		ensureStarted();
		const msg = {
			header: buildHeader(taskId, "StopSynthesis", appKey),
			payload: {},
			context: buildContext()
		};
		return new Promise<void>((resolve, reject) => {
			try {
				socketTask.send({ data: JSON.stringify(msg) });
				resolve();
			} catch (e) {
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
		run,
		stop,
		close,
		raw: socketTask
	};
};
