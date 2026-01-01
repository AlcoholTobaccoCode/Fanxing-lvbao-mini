import { request } from "@/cool";
import { type UserInfo } from "@/types/index.ts";

export type platformType = "miniprogram" | "app" | "web";

// 登录/注册统一返回的用户凭证结构
export interface UserAuthToken {
	access_token: string;
	expires_time: number;
	refresh_token: string;
	token_type: string;
	user_type: number;
	phone: string;
	user_name: string;
	user_id: number;
}

// 手机号 + 验证码登录
export interface LoginByCodePayload {
	phone: string;
	code: string;
	platform: platformType;
}

// 手机号 + 密码登录
export interface LoginByPasswordPayload {
	phone: string;
	password: string;
	platform: platformType;
}

// 注册
export interface RegisterPayload {
	phone: string | number;
	password: string;
	code: string | number;
	username: string;
	platform: platformType;
}

// token 刷新
export interface RefreshTokenPayload {
	refresh_token: string;
}

export interface RefreshTokenResponse {
	access_token: string;
	expires_time: number;
	refresh_token: string;
	token_type: string;
}

/**
 * 手机号 + 验证码登录
 */
export const LoginByCode = (data: LoginByCodePayload): Promise<UserAuthToken> => {
	return request({
		url: "/user/smsLogin",
		method: "POST",
		data
	}) as Promise<UserAuthToken>;
};

/**
 * 手机号 + 密码登录
 */
export const LoginByPassword = (data: LoginByPasswordPayload): Promise<UserAuthToken> => {
	return request({
		url: "/user/login",
		method: "POST",
		data
	}) as Promise<UserAuthToken>;
};

/**
 * 用户注册
 */
export const RegisterUser = (data: RegisterPayload): Promise<UserAuthToken> => {
	return request({
		url: "/user/register",
		method: "POST",
		data
	}) as Promise<UserAuthToken>;
};

/**
 * 获取用户信息
 */
export const GetUserProfile = (): Promise<UserInfo> => {
	return request({
		url: "/user/profile",
		method: "GET"
	}) as Promise<UserInfo>;
};

/**
 * 刷新 token
 */
export const RefreshToken = (data: RefreshTokenPayload): Promise<RefreshTokenResponse> => {
	return request({
		url: "/user/refresh",
		method: "POST",
		data
	}) as Promise<RefreshTokenResponse>;
};
