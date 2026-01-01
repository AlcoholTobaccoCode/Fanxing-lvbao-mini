import { isMp } from "@/cool";
import { dev } from "./dev";
import { prod } from "./prod";

// 判断当前是否为开发环境
export const isDev = process.env.NODE_ENV == "development";

// 忽略 token 校验的接口路径（这些接口不携带 Authorization header）
export const ignoreTokens: string[] = [
	"/user/refresh", // 刷新 token
	"/user/login", // 密码登录
	"/user/smsLogin", // 验证码登录
	"/user/register", // 注册
	"/common/sendSms" // 发送短信验证码
];

// 404 白名单：这些路径返回 404 时不当成错误（支持 * 通配符）
export const ignore404s: string[] = ["/lawyer/info"];

// 过滤解析逻辑接口名单：这些路径返回数据时，直接返回，不走 200 parse
export const ignoreParseData: string[] = [
	"/chat/getUserToken"
	// , "/law/queryCase" // 2025 年 12 月 29 日 16:56:42 - 接口已统一返参结构
];

// 微信配置
type WxConfig = {
	debug: boolean;
};

// 配置类型定义
type Config = {
	name: string; // 应用名称
	version: string; // 应用版本
	logo: string; // 应用 logo
	locale: string; // 应用语言
	website: string; // 官网地址
	host: string; // 主机地址
	baseUrl: string; // 基础路径
	showDarkButton: boolean; // 是否显示暗色模式切换按钮
	isCustomTabBar: boolean; // 是否自定义 tabBar
	backTop: boolean; // 是否显示回到顶部按钮
	wx: WxConfig; // 微信配置
	hxImDebug: boolean; // 是否开启环信 debug
	voiceCallUrl: string; // 阿里云 ai 实时通话
};

// 根据环境导出最终配置
export const config = {
	name: "律先峰",
	version: "1.0.0",
	locale: "zh",
	website: "https://lvbao.fanxingzhihui.com",
	logo: "https://fxzh01.oss-cn-hangzhou.aliyuncs.com/public/wxmini/logo.png",
	showDarkButton: isMp() ? false : true,
	isCustomTabBar: true,
	backTop: true,
	wx: {
		debug: false
	},
	hxImDebug: false,
	...(isDev ? dev() : prod())
} as Config;

// 导出代理相关配置
export * from "./proxy";
