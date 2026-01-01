import { isDev, ignoreTokens, ignore404s, ignoreParseData, config } from "@/config";
import { locale, t } from "@/locale";
import { isNull, isObject, parse } from "../utils";
import { useStore } from "../store";
import { ERROR_DEFAULT_MESSAGE } from "./error.map";
import { showLoginModal } from "../store/login-modal";
import { RefreshToken } from "@/api/user";

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

// 请求队列（用于等待 token 刷新后继续请求）
let pendingRequests: (() => void)[] = [];

// 标记 token 是否正在刷新
let isRefreshing = false;

/**
 * 刷新 token
 * @returns Promise<boolean> 刷新是否成功
 */
async function doRefreshToken(): Promise<boolean> {
	const { user } = useStore();

	if (!user.refreshToken) {
		return false;
	}

	try {
		const res = await RefreshToken({ refresh_token: user.refreshToken });
		user.updateToken({
			access_token: res.access_token,
			expires_time: res.expires_time,
			refresh_token: res.refresh_token
		});
		return true;
	} catch (err) {
		console.error("[RefreshToken] 刷新 token 失败", err);
		return false;
	}
}

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

const isIgnoreParseData = (url: string) => {
	return ignoreParseData.some((e) => {
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

	// 拼接基础 url
	if (!url.startsWith("http")) {
		url = config.baseUrl + url;
	}

	// 是否忽略 token 校验
	const ignoreToken = isIgnoreToken(url);

	return new Promise((resolve, reject) => {
		// 发起请求的实际函数
		const doRequest = () => {
			// 获取当前 token（可能是刷新后的新 token）
			const Authorization = ignoreToken ? null : user.token;

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
						// 尝试刷新 token
						if (user.refreshToken && !ignoreToken) {
							// 如果正在刷新，则加入等待队列
							if (isRefreshing) {
								pendingRequests.push(() => {
									doRequest();
								});
								return;
							}

							isRefreshing = true;

							doRefreshToken()
								.then((success) => {
									isRefreshing = false;

									if (success) {
										// 刷新成功，重试当前请求
										doRequest();
										// 执行等待队列中的请求
										pendingRequests.forEach((cb) => cb());
										pendingRequests = [];
									} else {
										// 刷新失败，退出登录
										user.logout();
										showLoginModal();
										reject({ message: t("请先登录"), code: 401 } as Response);
										// 清空等待队列
										pendingRequests = [];
									}
								})
								.catch(() => {
									isRefreshing = false;
									user.logout();
									showLoginModal();
									reject({ message: t("请先登录"), code: 401 } as Response);
									pendingRequests = [];
								});
						} else {
							// 没有 refresh_token，直接退出登录
							if (user.token) {
								user.logout();
							}
							showLoginModal();
							reject({ message: t("请先登录"), code: 401 } as Response);
						}
						return;
					}

					// 5xx 服务异常
					if (res.statusCode >= 500 && res.statusCode < 600) {
						reject({
							message: t("服务异常")
						} as Response);
						return;
					}

					// 404 未找到
					if (res.statusCode == 404) {
						if (isIgnore404(url)) {
							resolve(null);
						} else {
							reject({
								message: `[404] ${url}`
							} as Response);
						}
						return;
					}

					// 200 正常响应（业务 code 再细分）
					if (res.statusCode == 200) {
						if (res.data == null) {
							resolve(null);
							return;
						}
						if (!isObject(res.data as any)) {
							resolve(res.data);
							return;
						}
						// 取消解析
						if (isIgnoreParseData(url)) {
							resolve(res.data);
							return;
						}
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
						return;
					}

					// 其他 4xx：有结构化 body 时尽量解析错误码
					if (res.statusCode >= 400 && res.statusCode < 500) {
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
						return;
					}

					// 其他情况统一兜底
					reject({ message: t("服务异常") } as Response);
				},

				// 网络请求失败
				fail(err) {
					reject({ message: err.errMsg } as Response);
				}
			});
		};

		// 检查 token 是否即将过期，如果即将过期则先刷新
		if (!ignoreToken && user.token && user.refreshToken && user.isTokenExpiringSoon()) {
			if (isRefreshing) {
				// 如果正在刷新，加入等待队列
				pendingRequests.push(() => {
					doRequest();
				});
			} else {
				isRefreshing = true;
				doRefreshToken()
					.then((success) => {
						isRefreshing = false;
						doRequest();
						// 执行等待队列中的请求
						pendingRequests.forEach((cb) => cb());
						pendingRequests = [];
					})
					.catch(() => {
						isRefreshing = false;
						// 刷新失败也继续请求，让 401 处理
						doRequest();
						pendingRequests.forEach((cb) => cb());
						pendingRequests = [];
					});
			}
		} else {
			// 正常发起请求
			doRequest();
		}
	});
}
