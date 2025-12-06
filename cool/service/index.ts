import { isDev, ignoreTokens, ignore404s, config } from "@/config";
import { locale, t } from "@/locale";
import { isNull, isObject, parse } from "../utils";
import { useStore } from "../store";
import { ERROR_DEFAULT_MESSAGE } from "./error.map";

// 请求参数类型定义
export type RequestOptions = {
	url: string; // 请求地址
	method?: RequestMethod; // 请求方法
	data?: any; // 请求体数据
	params?: any; // URL参数
	header?: any; // 请求头
	timeout?: number; // 超时时间
	withCredentials?: boolean; // 是否携带凭证
	firstIpv4?: boolean; // 是否优先使用IPv4
	enableChunked?: boolean; // 是否启用分块传输
};

// 响应数据类型定义
export type Response = {
	code?: number;
	message?: string;
	data?: any;
	error?: string; // 后端错误码字符串，如 User.SmsCode.Invalid
};

// 请求队列（用于等待token刷新后继续请求）
let requests: ((token: string) => void)[] = [];

// 标记token是否正在刷新
let isRefreshing = false;

// 判断当前url是否忽略token校验
const isIgnoreToken = (url: string) => {
	return ignoreTokens.some((e) => {
		const pattern = e.replace(/\*/g, ".*");
		return new RegExp(pattern).test(url);
	});
};

const isIgnore404 = (url: string) => {
	return ignore404s.some((e) => {
		const pattern = e.replace(/\*/g, ".*");
		return new RegExp(pattern).test(url);
	});
};

/**
 * 通用请求方法
 * @param options 请求参数
 * @returns Promise<T>
 */
export function request(options: RequestOptions): Promise<any | null> {
	let { url, method = "GET", data = {}, header = {}, timeout = 60000 } = options;

	const { user } = useStore();

	// 开发环境下打印请求信息
	if (isDev) {
		console.log(`[${method}] ${url}`);
	}

	// 拼接基础url
	if (!url.startsWith("http")) {
		url = config.baseUrl + url;
	}

	// 获取当前token
	let Authorization: string | null = user.token;

	// 如果是忽略token的接口，则不携带token
	if (isIgnoreToken(url)) {
		Authorization = null;
	}

	return new Promise((resolve, reject) => {
		// 发起请求的实际函数
		const next = () => {
			uni.request({
				url,
				method,
				data,
				header: {
					Authorization,
					language: locale.value,
					...(header as UTSJSONObject)
				},
				timeout,

				success(res) {
					// 401 无权限
					if (res.statusCode == 401) {
						user.logout();
						reject({ message: t("无权限") } as Response);
					}

					// 5xx 服务异常
					else if (res.statusCode >= 500 && res.statusCode < 600) {
						reject({
							message: t("服务异常")
						} as Response);
					}

					// 404 未找到
					else if (res.statusCode == 404) {
						if (isIgnore404(url)) {
							resolve(null);
						} else {
							return reject({
								message: `[404] ${url}`
							} as Response);
						}
					}

					// 200 正常响应（业务 code 再细分）
					else if (res.statusCode == 200) {
						if (res.data == null) {
							resolve(null);
						} else if (!isObject(res.data as any)) {
							resolve(res.data);
						} else {
							// 解析响应数据
							const { code, message, data, error } = parse<Response>(
								res.data ?? { code: 0 }
							)!;

							if (code === 200) {
								resolve(data);
								return;
							}

							const fallback =
								(error && ERROR_DEFAULT_MESSAGE[error]) ||
								(error && ERROR_DEFAULT_MESSAGE[error.trim?.() || error]) ||
								t("服务异常");
							const finalMessage = message && message !== "" ? message : fallback;
							reject({ message: finalMessage, code, error } as Response);
						}
					}
					// 其他 4xx：有结构化 body 时尽量解析错误码
					else if (res.statusCode >= 400 && res.statusCode < 500) {
						if (res.data && isObject(res.data as any)) {
							const { code, message, error } = parse<Response>(res.data) ?? {};
							const fallback =
								(error && ERROR_DEFAULT_MESSAGE[error]) ||
								(error && ERROR_DEFAULT_MESSAGE[error.trim?.() || error]) ||
								t("服务异常");
							const finalMessage = message && message !== "" ? message : fallback;
							reject({ message: finalMessage, code, error } as Response);
						} else {
							reject({ message: t("服务异常") } as Response);
						}
					}
					// 其他情况统一兜底
					else {
						reject({ message: t("服务异常") } as Response);
					}
				},

				// 网络请求失败
				fail(err) {
					reject({ message: err.errMsg } as Response);
				}
			});
		};

		// TODO  - 等到 refreshToken 接入
		// 不再在客户端做 token 过期与刷新判断，统一由服务端通过 401 控制
		// token 存在时直接发起请求，401 时在上方逻辑中退出登录
		next();
	});
}
