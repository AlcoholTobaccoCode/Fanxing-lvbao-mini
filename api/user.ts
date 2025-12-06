import { request } from "@/cool";

// 登录/注册统一返回的用户凭证结构
export interface UserAuthToken {
	access_token: string;
	token_type: string;
	userType: number;
	phone: string;
	username: string;
}

// 手机号 + 验证码登录
export interface LoginByCodePayload {
	phone: string;
	code: string;
}

// 手机号 + 密码登录
export interface LoginByPasswordPayload {
	phone: string;
	password: string;
}

// 注册
export interface RegisterPayload {
	phone: string | number;
	password: string;
	code: string | number;
	username: string;
}

/**
 * 手机号 + 验证码登录
 */
export const LoginByCode = (data: LoginByCodePayload): Promise<UserAuthToken> => {
	return request({
		url: "/user/login",
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
