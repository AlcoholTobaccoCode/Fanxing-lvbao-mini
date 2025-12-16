declare const wx: any;

import EasemobSDK from "easemob-websdk/uniApp/Easemob-chat";
import { storage } from "@/cool";
import { config as globalConfig } from "@/config";
import { GetUserChatToken, type UserChatTokenData } from "@/api/common";
import { useStore } from "@/cool";
import { sdkEvents, emitReadStatusUpdated } from "./events";
import {
	UpdateReadStatus,
	type UpdateReadStatusPayload,
	type UpdateReadStatusResponse
} from "@/api/chat-im";

//#region type、声明

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

export interface EasemobTextMsgParams {
	to: string;
	chatType?: ChatType;
	msg: string;
	ext?: Record<string, any>;
}

export interface EasemobMediaMsgParamsBase {
	to: string;
	chatType?: ChatType;
	url: string;
	filename?: string;
	fileSize?: number;
	// 媒体宽高（图片 / 视频）
	width?: number;
	height?: number;
	// 媒体时长（音频 / 视频，单位：秒）
	length?: number;
	ext?: Record<string, any>;
}

export interface EasemobImageMsgParams extends EasemobMediaMsgParamsBase {}

export interface EasemobFileMsgParams extends EasemobMediaMsgParamsBase {
	// 文件 MIME 类型，可选
	filetype?: string;
}

export interface EasemobAudioMsgParams extends EasemobMediaMsgParamsBase {
	// 语音时长（秒），必填
	length: number;
}

export interface sendMsgRead {
	chatType?: ChatType;
	to: string; // 接收消息对象的用户 ID。
}

export interface EasemobEventHandlers {
	onOpened?: () => void;
	onClosed?: () => void;
	onTextMessage?: (message: any) => void;
	onError?: (error: any) => void;
	onTokenWillExpire?: () => void;
	onTokenExpired?: () => void;
}

export type HistorySearchDirection = "up" | "down";

export interface EasemobHistoryOptions {
	targetId: string;
	pageSize?: number;
	cursor?: string | number | null;
	chatType?: ChatType | "chatRoom";
	searchDirection?: HistorySearchDirection;
	searchOptions?: {
		from?: string;
		msgTypes?: string[];
		startTime?: number;
		endTime?: number;
	};
}

export interface EasemobConversationItem {
	conversationId: string;
	conversationType: ChatType | "chatRoom";
	isPinned?: boolean;
	pinnedTime?: number;
	lastMessage?: any;
	unReadCount?: number;
	marks?: string[];
}

export interface EasemobServerConversationsParams {
	pageSize?: number;
	cursor?: string;
	includeEmptyConversations?: boolean;
}

export interface EasemobServerConversationsResultData {
	conversations: EasemobConversationItem[];
	cursor: string;
}
export interface EasemobServerConversationsResult {
	type: number;
	data: EasemobServerConversationsResultData;
}

const USER_CHAT_TOKEN_STORAGE_KEY = "easemob_user_chat_token";
const TOKEN_EXPIRE_GUARD_SECONDS = 120;

//#endregion

// 发送消息时默认附加字段
// const sendMsgExt = () => {
// 	const { user } = useStore();

// 	return {
// 		sendUserInfo: {
// 			id: user.info.value?.id,
// 			name: user.info.value?.nickName,
// 			phone: user.info.value?.phone
// 		},
// 		receiverUserInfo: {}
// 	};
// };

// 获取当前登录用户信息
let reloadInit = 0;
const getUserInfoAndInit = async () => {
	// 重试超过 3 次停止
	if (reloadInit >= 3) return;
	const { user } = useStore();

	// 获取用户信息，未登录不执行
	await user.get();

	if (!user.isNull() && user.info.value?.id != null) {
		const uid = String(user.info.value.id);
		ensureGlobalIMForUser(uid).finally(() => (reloadInit += 1));
	} else {
		// TODO 跳转登录页面
	}
};

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

	try {
		conn = new sdk.connection({
			appKey: config.appKey,
			url: config.url || "wss://im-api-wechat.easemob.com/websocket",
			apiUrl: config.apiUrl || "https://a1.easemob.com",
			useOwnUploadFun: config.useOwnUploadFun ?? true,
			isHttpDNS: config.isHttpDNS ?? false,
			enableReportLogs: true,
			autoReconnectNumMax: 5
		});
		hasInit = true;
		// 关闭 debug
		console.info("globalConfig.hxImDebug ====> ", globalConfig.hxImDebug);
		conn?.getInstance?.().setDebugMode(globalConfig.hxImDebug);
	} catch (error) {
		console.error("hx connection error: ", error);
	}

	return conn;
}

export function getEasemobConnection() {
	return conn;
}

export async function addEasemobEventHandlers(handlers: EasemobEventHandlers) {
	if (!conn) {
		await getUserInfoAndInit();
		throw new Error(`[IM] 尚未初始化或初始化失败. [hasInit] => ${hasInit}`);
	}

	const { user } = useStore();

	const mergedHandlers: EasemobEventHandlers = {
		onOpened: handlers.onOpened,
		onClosed: handlers.onClosed,
		onError: handlers.onError,
		// 文本消息
		onTextMessage: (msg: any) => {
			try {
				sdkEvents.onTextMessage(msg);
			} catch (e) {
				console.error("[IM] sdkEvents.onTextMessage error", e);
			}
			handlers.onTextMessage && handlers.onTextMessage(msg);
		},
		// Token 即将过期（达到 80% 有效期）
		onTokenWillExpire: async () => {
			console.log("[IM] Token 马上过期，准备刷新...");
			try {
				const userId = String(user.info.value?.id || "");
				if (userId) {
					await refreshTokenAndRelogin(userId);
				}
			} catch (e) {
				console.error("[IM] Failed to refresh token on TokenWillExpire:", e);
			}
			handlers.onTokenWillExpire && handlers.onTokenWillExpire();
		},
		// Token 已过期
		onTokenExpired: async () => {
			console.log("[IM] Token 已过期，准备刷新...");
			try {
				const userId = String(user.info.value?.id || "");
				if (userId) {
					await refreshTokenAndRelogin(userId);
				}
			} catch (e) {
				console.error("[IM] Token 刷新失败:", e);
			}
			handlers.onTokenExpired && handlers.onTokenExpired();
		}
	};

	if (typeof conn.addEventHandler === "function") {
		conn.addEventHandler("app", mergedHandlers as any);
	} else if (typeof conn.listen === "function") {
		conn.listen(mergedHandlers as any);
	}
}

export async function loginEasemob(options: EasemobLoginOptions): Promise<any> {
	if (!conn) {
		await getUserInfoAndInit();
		throw new Error("[IM] 尚未初始化, 请先 initEasemob.");
	}

	return conn
		.open(options)
		.then(() => {
			console.log("[IM] login success");
			sdkEvents.onLogin();
		})
		.catch((reason) => {
			console.log("[IM] login fail", reason);
			sdkEvents.onLoginError(reason);
		});
}

function ensureImReadyForSend() {
	if (!conn || !sdk) {
		throw new Error("[IM] 尚未初始化, 请先 initEasemob.");
	}
	return { conn, sdk };
}

function sendEasemobMessageInternal(message: any, logPrefix: string) {
	const { conn } = ensureImReadyForSend();
	return new Promise((resolve, reject) => {
		conn.send(message)
			.then((res: any) => {
				console.log(`[IM] ${logPrefix} success`, res);
				sdkEvents.onSendMsg(res);
				resolve(res);
			})
			.catch((e: any) => {
				console.log(`[IM] ${logPrefix} fail`, e);
				sdkEvents.onSendMsgError(e);
				reject(e);
			});
	});
}

export async function sendEasemobTextMessage(params: EasemobTextMsgParams): Promise<any> {
	const { sdk } = ensureImReadyForSend();
	const chatType: ChatType = params.chatType || "singleChat";
	const message = sdk.message.create({
		type: "txt",
		chatType,
		to: params.to,
		msg: params.msg,
		ext: params.ext || {}
	});
	return sendEasemobMessageInternal(message, "Send text message");
}

export async function sendEasemobImageMessage(params: EasemobImageMsgParams): Promise<any> {
	const { sdk } = ensureImReadyForSend();
	const chatType: ChatType = params.chatType || "singleChat";
	const message = sdk.message.create({
		type: "img",
		chatType,
		to: params.to,
		file: {
			url: params.url,
			filename: params.filename,
			file_length: params.fileSize,
			width: params.width,
			height: params.height
		},
		ext: params.ext || {}
	});
	return sendEasemobMessageInternal(message, "Send image message");
}

export async function sendEasemobFileMessage(params: EasemobFileMsgParams): Promise<any> {
	const { sdk } = ensureImReadyForSend();
	const chatType: ChatType = params.chatType || "singleChat";
	const message = sdk.message.create({
		type: "file",
		chatType,
		to: params.to,
		file: {
			url: params.url,
			filename: params.filename,
			file_length: params.fileSize,
			filetype: params.filetype,
			length: params.length
		},
		ext: params.ext || {}
	});
	return sendEasemobMessageInternal(message, "Send file message");
}

export async function sendEasemobAudioMessage(params: EasemobAudioMsgParams): Promise<any> {
	const { sdk } = ensureImReadyForSend();
	const chatType: ChatType = params.chatType || "singleChat";
	const message = sdk.message.create({
		type: "audio",
		chatType,
		to: params.to,
		// 按照环信小程序官方示例，使用 body 传递已经上传完成的音频 URL 和时长
		body: {
			url: params.url,
			type: "audio",
			filename: params.filename,
			length: params.length
		},
		ext: params.ext || {}
	});
	return sendEasemobMessageInternal(message, "Send audio message");
}

export async function sendMsgRead(params: sendMsgRead): Promise<any> {
	const { sdk } = ensureImReadyForSend();
	const chatType: ChatType = params.chatType || "singleChat";
	const msg = sdk.message.create({
		chatType,
		type: "channel",
		to: params.to
	});
	conn.send(msg)
		.then((res: any) => {
			console.log(`[IM] success`, res);
		})
		.catch((e: any) => {
			console.log(`[IM] fail`, e);
		});
	// return sendEasemobMessageInternal(message, "Send audio message");
}

export function logoutEasemob() {
	if (conn && typeof conn.close === "function") {
		conn.close();
	}
}

// 清空环信相关缓存（退出登录时调用）
export function clearEasemobCache() {
	// 清除环信 Token 缓存
	storage.remove(USER_CHAT_TOKEN_STORAGE_KEY);

	// 断开环信连接
	logoutEasemob();

	// 重置初始化状态
	hasGlobalIMInited = false;

	console.log("[IM] Cache cleared and connection closed");
}

export async function getEasemobHistoryMessages(options: EasemobHistoryOptions): Promise<any> {
	if (!conn) {
		await getUserInfoAndInit();
		throw new Error(`[IM] 尚未初始化或初始化失败. [hasInit] => ${hasInit}`);
	}

	const merged: EasemobHistoryOptions & { [key: string]: any } = {
		pageSize: 20,
		searchDirection: "up",
		...options
	};

	return conn.getHistoryMessages(merged as any);
}

// 调用后端已读回执接口，并通过事件总线广播结果
export const markMessagesAsRead = async (
	payload: UpdateReadStatusPayload
): Promise<UpdateReadStatusResponse> => {
	// 更新环信那边的状态
	sendMsgRead({
		to: payload.peerId
	});

	// 更新自己的接口
	const res = (await UpdateReadStatus(payload)) as any;
	const data: UpdateReadStatusResponse = (res && res.data) || res;
	try {
		emitReadStatusUpdated(payload, data);
	} catch (e) {
		console.error("emitReadStatusUpdated error", e);
	}
	return data;
};

export async function getEasemobServerConversations(
	params: EasemobServerConversationsParams = {}
): Promise<EasemobServerConversationsResult> {
	if (!conn) {
		await getUserInfoAndInit();
		throw new Error(`[IM] 尚未初始化或初始化失败. [hasInit] => ${hasInit}`);
	}

	const merged: EasemobServerConversationsParams & { [key: string]: any } = {
		pageSize: 20,
		cursor: "",
		includeEmptyConversations: false,
		...params
	};

	console.info("merged =====> ", merged);

	const res = await (conn as any).getServerConversations(merged);
	return (res || {}) as EasemobServerConversationsResult;
}

// 刷新 Token 并重新登录
let isRefreshingToken = false;
export const refreshTokenAndRelogin = async (userId: string) => {
	// 防止并发刷新
	if (isRefreshingToken) {
		console.log("[IM] Token refresh already in progress");
		return;
	}

	try {
		isRefreshingToken = true;
		console.log("[IM] Refreshing token...");

		// 清除缓存的 Token，强制获取新的
		storage.remove(USER_CHAT_TOKEN_STORAGE_KEY);

		// 获取新的 Token
		const tokenData = await getValidUserChatToken();

		// 使用新 Token 重新登录
		await loginEasemob({
			user: userId,
			accessToken: tokenData.access_token
		});

		console.log("[IM] Token refreshed and relogin success");
	} catch (error) {
		console.error("[IM] Failed to refresh token:", error);
		throw error;
	} finally {
		isRefreshingToken = false;
	}
};

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

	addEasemobEventHandlers({});

	hasGlobalIMInited = true;
};
