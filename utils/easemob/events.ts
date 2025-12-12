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
		log.group("onLogin");
		log.info("im:onLogin 登录成功");
		log.groupEnd();
		// imBus.emit("im:onLogin", res);
	},
	// 登录失败
	onLoginError: (reason) => {
		log.group("onLoginError");
		log.info("im:onLoginError 登录失败 ===> ", JSON.stringify(reason));
		log.groupEnd();
		// imBus.emit("im:onLoginError", reason);
	},
	// 发送消息成功
	onSendMsg: (res) => {
		log.group("handleSonSendMsgend");
		log.info("im:onSendMsg 发送消息成功 ===> ", JSON.stringify(res));
		log.groupEnd();
		// imBus.emit("im:onSendMsg", res);
	},
	// 发送消息失败
	onSendMsgError: (e) => {
		log.group("onSendMsgError");
		log.info("im:onSendMsgError 发送消息失败 ===> ", JSON.stringify(e));
		log.groupEnd();
		// imBus.emit("im:onSendMsgError", e);
	},
	// 收到文本消息
	onTextMessage: (msg: OnTextMsgResult) => {
		log.group("onTextMessage");
		// log.info("im:onTextMessage 收到文本消息 ===> ", JSON.stringify(msg));
		log.groupEnd();
		// TODO - save
		imBus.emit("im:onTextMessage", msg);
	}
};
