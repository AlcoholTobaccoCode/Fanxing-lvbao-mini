import { createEventBus, type EventMap } from "@/utils/eventBus";
import { Logger } from "@/cool/utils/log";
import {
	type SaveChatMessagePayload,
	SaveChatMessage,
	type UpdateReadStatusPayload,
	type UpdateReadStatusResponse
} from "@/api/chat-im";

export interface OnTextMsgResult<T = any> {
	id: string;
	type: string;
	chatType: string;
	msg: string;
	to: string;
	from: string;
	ext: T;
	time: number;
	onlineState: number;
}

export interface IMEvents extends EventMap {
	"im:onLogin": null;
	"im:onLoginError": any;
	"im:onSendMsg": any;
	"im:onSendMsgError": any;
	"im:onTextMessage": OnTextMsgResult;
	// 连接状态相关事件
	"im:onConnected": null;
	"im:onDisconnected": any;
	"im:onReconnecting": null;
	"im:onOfflineMessageSyncStart": null;
	"im:onOfflineMessageSyncFinish": null;
	// 本地已读状态更新完成后触发（调用 /chat/readStatus 成功后触发）
	"im:onReadStatusUpdated": {
		peerId: string;
		beforeTimestamp?: number;
		messageIds?: string[];
		data: UpdateReadStatusResponse;
	};
}

const log = new Logger("[IM] Events");

export const imBus = createEventBus<IMEvents>();

// 环信回调统一管理
export const sdkEvents = {
	// 登录成功
	onLogin: () => {
		console.info("[IM] 登录成功 ✨✨✨ ");
		imBus.emit("im:onLogin", null);
	},
	// 登录失败
	onLoginError: (reason) => {
		console.info("[IM] 登录失败 reason =====> ", reason);
		imBus.emit("im:onLoginError", reason);
	},
	// 连接成功
	onConnected: () => {
		console.info("[IM] 连接成功 ✨");
		imBus.emit("im:onConnected", null);
	},
	// 连接断开
	onDisconnected: (reason: any) => {
		console.warn("[IM] 连接断开 reason =====> ", reason);
		imBus.emit("im:onDisconnected", reason);
	},
	// 正在重连
	onReconnecting: () => {
		console.info("[IM] 正在重连...");
		imBus.emit("im:onReconnecting", null);
	},
	// 离线消息同步开始
	onOfflineMessageSyncStart: () => {
		console.info("[IM] 离线消息同步开始");
		imBus.emit("im:onOfflineMessageSyncStart", null);
	},
	// 离线消息同步完成
	onOfflineMessageSyncFinish: () => {
		console.info("[IM] 离线消息同步完成 ✨");
		imBus.emit("im:onOfflineMessageSyncFinish", null);
	},
	// 发送消息成功
	onSendMsg: (res) => {
		console.info("[IM] 发送消息成功 res =====> ", res);
		imBus.emit("im:onSendMsg", res);
		const msg = res.message || {};
		const body = msg.body || {};
		const msgType = msg.type || body.type || "txt";

		// 基础字段
		const payload: SaveChatMessagePayload = {
			message_id: msg.id,
			senderId: msg.from,
			receiverId: msg.to,
			msgType: msgType,
			content: ""
		};

		// 根据消息类型填充字段
		if (msgType === "txt") {
			payload.content = msg.msg || body.msg || "";
		} else {
			// 富媒体消息：audio/image/video/file
			payload.fileUrl = msg.url || body.url || "";
			payload.fileName = msg.filename || body.filename || "";
			payload.content = "";

			// 音视频时长
			if (msgType === "audio" || msgType === "video") {
				payload.duration = msg.length || body.length || 0;
			}

			// 图片/视频尺寸
			if (msgType === "image" || msgType === "video") {
				payload.width = msg.width || body.width;
				payload.height = msg.height || body.height;
			}

			// 文件大小
			payload.size = msg.file_length || body.file_length;
		}

		// ext 扩展字段
		if (msg.ext || body.ext) {
			payload.ext = msg.ext || body.ext;
		}

		log.info("onSendMsg Save payload", payload);
		SaveChatMessage(payload)
			.then(() => {
				log.info("SaveChatMessage Success");
			})
			.catch((e) => {
				log.info("SaveChatMessage Error:", JSON.stringify(e));
			});
	},
	// 发送消息失败
	onSendMsgError: (e) => {
		imBus.emit("im:onSendMsgError", e);
	},
	// 收到文本消息
	onTextMessage: (msg: OnTextMsgResult) => {
		imBus.emit("im:onTextMessage", msg);
	}
};

// 触发本地已读状态更新事件，供其他模块在调用 UpdateReadStatus 接口成功后使用
export const emitReadStatusUpdated = (
	request: UpdateReadStatusPayload,
	response: UpdateReadStatusResponse
) => {
	imBus.emit("im:onReadStatusUpdated", {
		peerId: request.peerId,
		beforeTimestamp: request.beforeTimestamp,
		messageIds: request.messageIds,
		data: response
	});
};
