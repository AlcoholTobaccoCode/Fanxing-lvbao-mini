import { createEventBus, type EventMap } from "@/utils/eventBus";
import { Logger } from "@/cool/utils/log";

interface OnTextMsgResult<T = any> {
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

interface IMEvents extends EventMap {
	"im:onLogin": null;
	"im:onLoginError": any;
	"im:onSendMsg": any;
	"im:onSendMsgError": any;
	"im:onTextMessage": OnTextMsgResult;
}

const log = new Logger("[IM] Events");

export const imBus = createEventBus<IMEvents>();

// 环信回调统一管理
export const sdkEvents = {
	// 登录成功
	onLogin: () => {
		imBus.emit("im:onLogin", null);
	},
	// 登录失败
	onLoginError: (reason) => {
		imBus.emit("im:onLoginError", reason);
	},
	// 发送消息成功
	onSendMsg: (res) => {
		imBus.emit("im:onSendMsg", res);
	},
	// 发送消息失败
	onSendMsgError: (e) => {
		imBus.emit("im:onSendMsgError", e);
	},
	// 收到文本消息
	onTextMessage: (msg: OnTextMsgResult) => {
		// TODO - save
		imBus.emit("im:onTextMessage", msg);
	}
};
