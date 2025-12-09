// 轻量版 Aliyun TTS 封装：直接使用 wx.connectSocket，不依赖官方 JS SDK

declare const wx: any;

export interface AliyunTTSOptions {
	text: string;
	token: string;
	appKey: string;
	region?: string;
	voice?: string;
	format?: "mp3" | "wav" | "pcm";
	sampleRate?: number;
	emotion?: string;
}

const getServerConfig = (type: string = "long") => {
	// 实时长文本语音合成
	// https://help.aliyun.com/zh/isi/developer-reference/sdk-reference-6
	const config = {
		long: {
			namespace: "SpeechLongSynthesizer",
			name: "StartSynthesis"
		},
		// 语音合成
		// https://help.aliyun.com/zh/isi/developer-reference/overview-of-speech-synthesis
		simple: {
			namespace: "SpeechSynthesizer",
			name: "StartSynthesis"
		}
	};

	return config[type];
};

/**
 * 通过 Aliyun 语音合成 WebSocket 接口合成语音
 * 仅在微信小程序环境下可用，返回本地临时音频文件路径
 */
export function synthesizeTTS(options: AliyunTTSOptions): Promise<string> {
	const {
		text,
		token,
		appKey,
		region = "cn-shanghai",
		voice = "aixia",
		format = "mp3",
		sampleRate = 16000,
		emotion
	} = options;

	if (!text || !text.trim()) {
		return Promise.reject(new Error("合成文本不能为空"));
	}

	// 按官方 wx Demo 使用 ws/v1，并通过 Header 传递 X-NLS-Token
	const wsUrl = `wss://nls-gateway.${region}.aliyuncs.com/ws/v1`;

	return new Promise((resolve, reject) => {
		const audioChunks: ArrayBuffer[] = [];

		const socketTask = wx.connectSocket({
			url: wsUrl,
			tcpNoDelay: true,
			header: {
				"X-NLS-Token": token
			},
			success: () => console.log("[AliyunTTS] WebSocket 连接成功"),
			fail: (err: any) => {
				console.error("[AliyunTTS] 连接失败", err);
				reject(new Error(`WebSocket 连接失败: ${err.errMsg || "未知错误"}`));
			}
		});

		socketTask.onOpen(() => {
			// 发送合成请求报文：兼容微信小程序 SDK 的 SpeechSynthesizer StartSynthesis 协议
			const randomHex = () => {
				// 生成 32 位十六进制字符串，等价于旧版 uuid(true)
				const bytes = new Uint8Array(16);
				for (let i = 0; i < bytes.length; i++) {
					bytes[i] = Math.floor(Math.random() * 256);
				}
				return Array.from(bytes)
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("");
			};

			const taskId = randomHex();
			const messageId = randomHex();

			const message = {
				header: {
					message_id: messageId,
					task_id: taskId,
					namespace: getServerConfig().namespace,
					name: getServerConfig().name,
					appkey: appKey
				},
				payload: {
					text,
					voice,
					format,
					sample_rate: sampleRate,
					volume: 50,
					speech_rate: 0,
					pitch_rate: 0,
					enable_subtitle: false,
					...(emotion ? { emotion } : {})
				},
				context: {
					sdk: {
						name: "nls-wx-sdk",
						version: "0.0.1",
						language: "wxjs"
					}
				}
			};

			socketTask.send({
				data: JSON.stringify(message)
			});
		});

		socketTask.onMessage((res: { data: string | ArrayBuffer }) => {
			if (typeof res.data === "string") {
				try {
					const msg = JSON.parse(res.data);
					const name = msg?.header?.name;
					if (name === "TaskFailed") {
						const errorMsg = msg.payload?.message || "合成任务失败";
						console.error("[AliyunTTS] TaskFailed full:", JSON.stringify(msg));
						socketTask.close();
						reject(new Error(errorMsg));
					} else if (name === "SynthesisCompleted") {
						writeAudioToFile(audioChunks, format)
							.then((path) => {
								socketTask.close();
								resolve(path);
							})
							.catch((err) => {
								socketTask.close();
								reject(err);
							});
					}
				} catch (e) {
					console.warn("[AliyunTTS] 非 JSON 文本消息:", res.data);
				}
			} else if (res.data instanceof ArrayBuffer) {
				audioChunks.push(res.data);
			}
		});

		socketTask.onError((err: any) => {
			console.error("[AliyunTTS] WebSocket 错误", err);
			try {
				socketTask.close();
			} catch (e) {
				// ignore
			}
			reject(new Error(`WebSocket 错误: ${err.errMsg || "未知错误"}`));
		});

		socketTask.onClose((res: any) => {
			console.log("[AliyunTTS] WebSocket 已关闭", res);
		});
	});
}

// 写入临时音频文件，返回文件路径
function writeAudioToFile(chunks: ArrayBuffer[], format: "mp3" | "wav" | "pcm"): Promise<string> {
	return new Promise((resolve, reject) => {
		if (!chunks || chunks.length === 0) {
			return reject(new Error("未收到任何音频数据"));
		}

		const totalLength = chunks.reduce((sum, buf) => sum + buf.byteLength, 0);
		const merged = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			merged.set(new Uint8Array(chunk), offset);
			offset += chunk.byteLength;
		}

		const ext = format === "pcm" ? "pcm" : format;
		const tempFilePath = `${wx.env.USER_DATA_PATH}/tts_${Date.now()}.${ext}`;
		const fs = wx.getFileSystemManager();

		fs.writeFile({
			filePath: tempFilePath,
			data: merged.buffer,
			encoding: "binary",
			success: () => {
				console.log("[AliyunTTS] 音频已保存到:", tempFilePath);
				resolve(tempFilePath);
			},
			fail: (err: any) => {
				console.error("[AliyunTTS] 写入文件失败:", err);
				reject(new Error(`写入临时文件失败: ${err.errMsg || ""}`));
			}
		});
	});
}
