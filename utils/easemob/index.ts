declare const wx: any;

import EasemobSDK from "easemob-websdk/uniApp/Easemob-chat";
import { storage } from "@/cool";
import { GetUserChatToken, type UserChatTokenData } from "@/api/common";

export const IM_APP_KEY = "1168250507209322#demo";

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

const USER_CHAT_TOKEN_STORAGE_KEY = "easemob_user_chat_token";
const TOKEN_EXPIRE_GUARD_SECONDS = 120;

const loadCachedUserChatToken = (): UserChatTokenData | null => {
	try {
		if (storage.isExpired(USER_CHAT_TOKEN_STORAGE_KEY)) {
			return null;
		}
		const value = storage.get(USER_CHAT_TOKEN_STORAGE_KEY) as UserChatTokenData | null;
		return value ?? null;
	} catch {
		return null;
	}
};

const saveCachedUserChatToken = (data: UserChatTokenData) => {
	try {
		const rawExpiresIn = Number((data as any).expires_in ?? 0);
		let ttl = rawExpiresIn - TOKEN_EXPIRE_GUARD_SECONDS;
		if (!Number.isFinite(ttl) || ttl < 0) {
			ttl = 0;
		}
		storage.set(USER_CHAT_TOKEN_STORAGE_KEY, data, ttl);
	} catch {
		// ignore
	}
};

export const getValidUserChatToken = async (): Promise<UserChatTokenData> => {
	const cached = loadCachedUserChatToken();
	if (cached) return cached;

	const fresh = await GetUserChatToken();
	if (fresh) {
		saveCachedUserChatToken(fresh);
	}
	return fresh;
};

let sdk: any = null;
let conn: any = null;
let hasInit = false;
let hasGlobalIMInited = false;

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
		// TODO - 重试
		throw new Error("[IM] 尚未初始化获初始化失败.");
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

export const ensureGlobalIMForUser = async (userId: string) => {
	if (!userId) return;
	if (hasGlobalIMInited && conn) {
		return;
	}

	const tokenData = await getValidUserChatToken();
	initEasemob({
		appKey: IM_APP_KEY
	});

	await loginEasemob({
		user: userId,
		accessToken: tokenData.access_token
	});

	hasGlobalIMInited = true;
};
