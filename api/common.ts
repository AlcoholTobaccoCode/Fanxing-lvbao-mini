import { config } from "@/config";
import { request } from "@/cool";

export interface OssStsData {
	AccessKeyId: string;
	AccessKeySecret: string;
	SecurityToken: string;
	Expiration: string;
}

export interface OssStsResponse {
	code: number;
	msg: string;
	data: OssStsData | null;
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
				const body = res.data as OssStsResponse;
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
 */
export const SendSms = (data: SendSmsPayload): Promise<any | null> => {
	return request({
		url: "/user/sendSms",
		method: "POST",
		data
	});
};
