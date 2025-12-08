import { config } from "@/config";
import { request } from "@/cool";
import { type ApiResponse } from "./types";

export interface OssStsData {
	AccessKeyId: string;
	AccessKeySecret: string;
	SecurityToken: string;
	Expiration: string;
}

/**
 * 获取阿里云 OSS 的 STS 临时凭证
 *
 * 注意：/utils/sts 接口返回 code=200，而不是通用业务 code=1000，
 * 所以这里直接用 uni.request，而不是 cool/service.request。
 */
export const GetOssSts = async (): Promise<OssStsData> => {
	return new Promise((resolve, reject) => {
		uni.request({
			url: `${config.baseUrl}/utils/sts`,
			method: "GET",
			success(res) {
				const body = res.data as ApiResponse<OssStsData>;
				if (res.statusCode === 200 && body && body.code === 200 && body.data) {
					resolve(body.data);
				} else {
					reject(
						new Error(
							`获取 OSS STS 失败: status=${res.statusCode}, code=${(body && body.code) || ""}`
						)
					);
				}
			},
			fail(err) {
				reject(err);
			}
		});
	});
};

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

// /utils/voice/token

export interface VoiceTokenData {
	token: string;
	expire_time: number;
	region: string;
	domain: string;
	version: string;
	action: string;
	raw: {
		ErrMsg: string;
		Token: {
			UserId: string;
			Id: string;
			ExpireTime: number;
		};
	};
}
/**
 *
 * @param data
 * @returns
 */
export const GetVoiceToken = (): Promise<VoiceTokenData> => {
	return request({
		url: "/utils/voice/token",
		method: "POST"
	});
};
