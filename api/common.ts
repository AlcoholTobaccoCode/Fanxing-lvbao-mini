import { config } from "@/config";
import { request } from "@/cool";
import { type ApiResponse } from "./types";

//#region SMS 相关

// 短信发送场景
export type SmsScene = "login" | "lawyer";

export interface SendSmsPayload {
	phone: string;
	scene: SmsScene;
}

/**
 * 发送短信验证码
 * @param data.phone 手机号
 * @param data.scene 场景 - login 登录 ｜ lawyer 律师认证
 */
export const SendSms = (data: SendSmsPayload): Promise<any | null> => {
	return request({
		url: "/user/sendSms",
		method: "POST",
		data
	});
};

//#endregion

//#region 阿里云服务相关

/**
 * 获取阿里云 TTS 鉴权
 */
export interface VoiceTokenData {
	token: string;
	expire_time: number;
	region: string;
	domain: string;
	version: string;
	action: string;
	appKey: string;
	raw: {
		ErrMsg: string;
		Token: {
			UserId: string;
			Id: string;
			ExpireTime: number;
		};
	};
}

export const GetVoiceToken = (): Promise<VoiceTokenData> => {
	return request({
		url: "/utils/voice/token",
		method: "POST"
	});
};

/**
 * 获取阿里云 OSS Signature
 */

export interface OssSignatureData {
	policy: string;
	x_oss_signature_version: string;
	x_oss_credential: string;
	x_oss_date: string;
	signature: string;
	security_token: string;
}

export const GetOssSignature = (): Promise<OssSignatureData> => {
	return request({
		url: "/utils/sts/sign",
		method: "GET"
	});
};
//#region 环信 IM 相关

export interface UserChatInfo {
	uuid: string;
	type: string;
	created: number;
	modified: number;
	username: string;
	activated: boolean;
}

export interface UserChatTokenData {
	access_token: string;
	expires_in: number;
	user: UserChatInfo;
}

/**
 * 获取 User Token
 */
export const GetUserChatToken = (): Promise<UserChatTokenData> => {
	return request({
		url: "/chat/getUserToken",
		method: "GET"
	});
};

//#endregion
