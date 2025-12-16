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
	// 发送消息成功
	onSendMsg: (res) => {
		console.info("[IM] 发送消息成功 res =====> ", res);
		imBus.emit("im:onSendMsg", res);
		const msg = res.message || {};
		// TODO - 多媒体 消息区分
		const payload: SaveChatMessagePayload = {
			message_id: msg.id,
			senderId: msg.from,
			receiverId: msg.to,
			senderRole: "user",
			msgType: msg.type,
			content: msg.msg
		};
		log.info("onTextMessage Save payload", payload);
		SaveChatMessage(payload)
			.then(() => {
				log.info("onTextMessage Save Success");
			})
			.catch((e) => {
				log.info("onTextMessage Save Error:", JSON.stringify(e));
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
