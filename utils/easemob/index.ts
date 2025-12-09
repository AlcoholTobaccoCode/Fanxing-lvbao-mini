declare const wx: any;

import EasemobSDK from "easemob-websdk/uniApp/Easemob-chat";

export type ChatType = "singleChat" | "groupChat";

export interface EasemobInitConfig {
	appKey: string;
	url?: string;
	apiUrl?: string;
	isHttpDNS?: boolean;
	useOwnUploadFun?: boolean;
}

export interface EasemobLoginOptions {
	user: string;
	pwd?: string;
	accessToken?: string;
}

export interface EasemobTextMessageParams {
	to: string;
	chatType?: ChatType;
	msg: string;
	ext?: Record<string, any>;
}

export interface EasemobEventHandlers {
	onOpened?: () => void;
	onClosed?: () => void;
	onTextMessage?: (message: any) => void;
	onError?: (error: any) => void;
}

let sdk: any = null;
let conn: any = null;
let hasInit = false;

export function initEasemob(config: EasemobInitConfig) {
	if (hasInit && conn) return conn;

	sdk = EasemobSDK as any;
	if (typeof wx !== "undefined" && wx) {
		(wx as any).WebIM = sdk;
	}

	conn = new sdk.connection({
		appKey: config.appKey,
		url: config.url || "wss://im-api-wechat.easemob.com/websocket",
		apiUrl: config.apiUrl || "https://a1.easemob.com",
		useOwnUploadFun: config.useOwnUploadFun ?? true,
		isHttpDNS: config.isHttpDNS ?? false
	});

	hasInit = true;
	return conn;
}

export function getEasemobConnection() {
	return conn;
}

export function addEasemobEventHandlers(handlers: EasemobEventHandlers) {
	if (!conn) {
		throw new Error("Easemob has not been initialized. Call initEasemob first.");
	}

	if (typeof conn.addEventHandler === "function") {
		conn.addEventHandler("app", {
			onOpened: handlers.onOpened,
			onClosed: handlers.onClosed,
			onTextMessage: handlers.onTextMessage,
			onError: handlers.onError
		});
	} else if (typeof conn.listen === "function") {
		conn.listen({
			onOpened: handlers.onOpened,
			onClosed: handlers.onClosed,
			onTextMessage: handlers.onTextMessage,
			onError: handlers.onError
		});
	}
}

export function loginEasemob(options: EasemobLoginOptions): Promise<any> {
	if (!conn) {
		throw new Error("Easemob has not been initialized. Call initEasemob first.");
	}

	return conn.open(options);
}

export function logoutEasemob() {
	if (conn && typeof conn.close === "function") {
		conn.close();
	}
}

export async function sendEasemobTextMessage(params: EasemobTextMessageParams): Promise<any> {
	if (!conn || !sdk) {
		throw new Error("Easemob has not been initialized. Call initEasemob first.");
	}

	const chatType: ChatType = params.chatType || "singleChat";
	const message = sdk.message.create({
		type: "txt",
		chatType,
		to: params.to,
		msg: params.msg,
		ext: params.ext || {}
	});

	return conn.send(message);
}
