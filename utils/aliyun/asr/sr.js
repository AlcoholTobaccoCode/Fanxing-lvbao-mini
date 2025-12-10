/*
sr.js

Copyright 1999-present Alibaba Group Holding Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

"use strict";

// 简单的事件总线实现，替代原来的 EventBus 依赖
class SimpleEventBus {
	constructor() {
		this._events = {};
	}

	on(name, handler) {
		if (!this._events[name]) this._events[name] = [];
		this._events[name].push(handler);
	}

	off(name) {
		if (!name) {
			this._events = {};
			return;
		}
		this._events[name] = [];
	}

	emit(name, payload) {
		const list = this._events[name] || [];
		for (let i = 0; i < list.length; i++) {
			try {
				list[i](payload);
			} catch (e) {
				console.error("[SimpleEventBus] handler error", e);
			}
		}
	}
}

// 精简版 NlsClient：这里只保留与 sr.js 交互必需的接口
class NlsClient {
	constructor(config) {
		// 与官方 nls.js 一致：必须包含 url / appkey / token
		if (!config || !config.url || !config.appkey || !config.token) {
			throw new Error("invalid config!");
		}
		this._config = config;
		this._ws = null;
	}

	uuid() {
		// 参考官方 uuid(true)：生成 36 位 UUID，并去掉连字符，返回 32 位十六进制字符串
		const s = [];
		const hexDigits = "0123456789abcdef";
		for (let i = 0; i < 36; i++) {
			s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
		}
		s[14] = "4";
		// v4 UUID variant，参考官方： (s[19] & 0x3) | 0x8
		const s19 = parseInt(s[19], 16);
		const v19 = ((s19 & 0x3) | 0x8) & 0xf;
		s[19] = hexDigits.substr(v19, 1);
		s[8] = s[13] = s[18] = s[23] = "-";
		const uuid = s.join("");
		return uuid.split("-").join("");
	}

	defaultContext() {
		// 与官方 nls.js 保持一致
		return {
			sdk: {
				name: "nls-wx-sdk",
				version: "0.0.1",
				language: "wxjs"
			}
		};
	}

	start(onMessage, onClose) {
		return new Promise((resolve, reject) => {
			try {
				const url = this._config.url;
				if (!url) {
					reject("NlsClient url is required");
					return;
				}
				// 微信小程序 / uni-app 小程序环境使用 wx.connectSocket
				// 参考官方 SDK：携带 X-NLS-Token 头完成鉴权
				// #ifdef MP-WEIXIN
				const socketTask = wx.connectSocket({
					url,
					tcpNoDelay: true,
					header: {
						"X-NLS-Token": this._config.token
					}
				});
				this._ws = socketTask;
				// 打开
				socketTask.onOpen(() => {
					resolve();
				});
				// 消息
				socketTask.onMessage((res) => {
					const data = res.data;
					// 小程序下 data 一般是 ArrayBuffer 或字符串
					onMessage(data);
				});
				// 关闭
				socketTask.onClose(() => {
					this._ws = null;
					onClose && onClose();
				});
				// 错误
				socketTask.onError((err) => {
					console.error("[NlsClient] socket error", err);
				});
				// #endif
				// #ifndef MP-WEIXIN
				// 其他环境简单使用 WebSocket（如 H5 调试）
				const ws = new WebSocket(url);
				this._ws = ws;
				ws.onopen = () => resolve();
				ws.onmessage = (evt) => {
					const data = evt.data;
					onMessage(data);
				};
				ws.onclose = () => {
					this._ws = null;
					onClose && onClose();
				};
				ws.onerror = (err) => {
					console.error("[NlsClient] ws error", err);
				};
				// #endif
			} catch (e) {
				reject(e);
			}
		});
	}

	send(data) {
		if (!this._ws) return;
		try {
			// #ifdef MP-WEIXIN
			this._ws.send({ data });
			// #endif
			// #ifndef MP-WEIXIN
			this._ws.send(data);
			// #endif
		} catch (e) {
			console.error("[NlsClient] send error", e);
		}
	}

	shutdown() {
		if (!this._ws) return;
		try {
			this._ws.close();
		} catch (e) {
			console.error("[NlsClient] close error", e);
		}
		this._ws = null;
	}
}

class SpeechRecognition {
	constructor(config) {
		this._event = new SimpleEventBus();
		this._config = config || {};
	}

	defaultStartParams() {
		return {
			format: "pcm",
			sample_rate: 16000,
			enable_intermediate_result: true,
			enable_punctuation_prediction: true,
			enable_inverse_text_normalization: true,
			enable_voice_detection: true,
			max_end_silence: 2000
		};
	}

	on(which, handler) {
		this._event.off(which);
		this._event.on(which, handler);
	}

	start(param) {
		this._client = new NlsClient(this._config);
		this._taskid = this._client.uuid();
		const req = {
			header: {
				message_id: this._client.uuid(),
				task_id: this._taskid,
				namespace: "SpeechRecognizer",
				name: "StartRecognition",
				appkey: this._config.appkey
			},
			payload: param,
			context: this._client.defaultContext()
		};
		return new Promise((resolve, reject) => {
			this._client
				.start(
					(msg) => {
						let str = msg && msg.toString ? msg.toString() : String(msg || "");
						let msgObj = {};
						try {
							msgObj = JSON.parse(str);
						} catch (e) {
							console.error("[SpeechRecognition] JSON parse error", e, str);
						}
						const name = msgObj.header && msgObj.header.name;
						if (name === "RecognitionStarted") {
							this._event.emit("started", str);
							resolve(str);
						} else if (name === "RecognitionResultChanged") {
							this._event.emit("changed", str);
						} else if (name === "RecognitionCompleted") {
							this._event.emit("RecognitionCompleted", str);
						} else if (name === "TaskFailed") {
							this._client.shutdown();
							this._client = null;
							this._event.emit("TaskFailed", str);
							this._event.emit("failed", str);
						}
					},
					() => {
						this._event.emit("closed");
					}
				)
				.then(() => {
					// 连接成功建立后再发送 StartRecognition 请求
					this._client.send(JSON.stringify(req));
				})
				.catch((error) => {
					reject(error);
				});
		});
	}

	close(param) {
		if (!this._client) {
			return new Promise((resolve, reject) => {
				if (typeof wx !== "undefined" && wx && wx.nextTick) {
					wx.nextTick(() => reject("client is null"));
				} else {
					reject("client is null");
				}
			});
		}

		const req = {
			header: {
				message_id: this._client.uuid(),
				task_id: this._taskid,
				namespace: "SpeechRecognizer",
				name: "StopRecognition",
				appkey: this._config.appkey
			},
			payload: param,
			context: this._client.defaultContext()
		};

		return new Promise((resolve, reject) => {
			this._event.off("RecognitionCompleted");
			this._event.on("RecognitionCompleted", (msg) => {
				if (this._client) {
					this._client.shutdown();
					this._client = null;
				}
				this._event.emit("completed", msg);
				resolve(msg);
			});
			this._event.off("TaskFailed");
			this._event.on("TaskFailed", (msg) => {
				reject(msg);
			});
			this._client.send(JSON.stringify(req), false);
		});
	}

	shutdown() {
		if (!this._client) return;
		this._client.shutdown();
	}

	sendAudio(data) {
		if (!this._client) {
			return false;
		}
		this._client.send(data);
		return true;
	}
}

// 挂载到全局，供 TypeScript 侧的 declare const SpeechRecognition 使用
if (typeof globalThis !== "undefined") {
	globalThis.SpeechRecognition = SpeechRecognition;
} else if (typeof window !== "undefined") {
	window.SpeechRecognition = SpeechRecognition;
} else if (typeof global !== "undefined") {
	global.SpeechRecognition = SpeechRecognition;
}
