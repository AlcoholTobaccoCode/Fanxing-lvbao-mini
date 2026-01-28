/**
 * IM 应用生命周期管理
 * 处理 App 的 onLaunch、onShow、onHide 等生命周期中的 IM 逻辑
 */
import { useStore } from "@/cool";
import { ensureGlobalIMForUser, logoutEasemob, refreshTokenAndRelogin } from "./index";
import { imBus } from "./events";

// 需要重新登录的错误码
// 2: 登录鉴权失败, 28: 未传 token, 56: Token 过期
// 206: 被其他设备踢下线, 216: 密码被修改, 217: 被其他设备强制下线
const RELOGIN_ERROR_CODES = [2, 28, 56, 206, 216, 217];

// 手动重连计数器（防止无限重连）
let manualReconnectCount = 0;
const MAX_MANUAL_RECONNECT = 3;

// 标记事件监听器是否已注册
let imEventsRegistered = false;

/**
 * 处理登录错误
 */
const handleLoginError = async (res: any) => {
	console.warn("[IM] 登录错误:", res);
	if (RELOGIN_ERROR_CODES.includes(res.type)) {
		const { user } = useStore();
		if (!user.isNull() && user.info.value?.id != null) {
			console.log("[IM] 尝试刷新 Token 并重新登录...");
			await refreshTokenAndRelogin(String(user.info.value?.id));
		}
	}
};

/**
 * 处理连接断开
 */
const handleDisconnected = async (res: any) => {
	console.warn("[IM] 连接断开:", res);

	// 如果是网络问题或重连次数用尽，尝试手动重连
	if (manualReconnectCount < MAX_MANUAL_RECONNECT) {
		const { user } = useStore();
		if (!user.isNull() && user.info.value?.id != null) {
			manualReconnectCount++;
			console.log(`[IM] 尝试手动重连 (${manualReconnectCount}/${MAX_MANUAL_RECONNECT})...`);

			// 延迟 2 秒后重连，避免频繁请求
			setTimeout(async () => {
				try {
					await refreshTokenAndRelogin(String(user.info.value?.id));
					manualReconnectCount = 0;
				} catch (e) {
					console.error("[IM] 手动重连失败:", e);
				}
			}, 2000);
		}
	} else {
		console.warn("[IM] 已达到最大手动重连次数，停止重连");
	}
};

/**
 * 处理重连中
 */
const handleReconnecting = () => {
	console.log("[IM] SDK 正在自动重连...");
};

/**
 * 处理连接成功
 */
const handleConnected = () => {
	console.log("[IM] 连接成功");
	manualReconnectCount = 0;
};

/**
 * 注册 IM 事件监听器（只注册一次）
 * 在 App.onLaunch 中调用
 */
export const setupIMEventListeners = () => {
	if (imEventsRegistered) return;

	imBus.on("im:onLoginError", handleLoginError);
	imBus.on("im:onDisconnected", handleDisconnected);
	imBus.on("im:onReconnecting", handleReconnecting);
	imBus.on("im:onConnected", handleConnected);

	imEventsRegistered = true;
	console.log("[IM] 事件监听器已注册");
};

/**
 * App 进入前台时的 IM 处理
 * 在 App.onShow 中调用
 */
export const handleIMAppShow = async () => {
	const { user } = useStore();

	// 获取用户信息，未登录不执行
	await user.get();
	if (!user.isNull() && user.info.value?.id != null) {
		const uid = String(user.info.value.id);
		ensureGlobalIMForUser(uid).catch((err) => {
			console.error("[IM] 全局初始化失败", err);
		});
	}
};

/**
 * App 进入后台时的 IM 处理
 * 在 App.onHide 中调用
 */
export const handleIMAppHide = () => {
	logoutEasemob();
};

/**
 * 重置手动重连计数器
 * 在用户主动登录成功后调用
 */
export const resetReconnectCount = () => {
	manualReconnectCount = 0;
};

/**
 * 清理 IM 事件监听器
 * 在 App 销毁或用户登出时调用
 */
export const cleanupIMEventListeners = () => {
	if (!imEventsRegistered) return;

	imBus.off("im:onLoginError", handleLoginError);
	imBus.off("im:onDisconnected", handleDisconnected);
	imBus.off("im:onReconnecting", handleReconnecting);
	imBus.off("im:onConnected", handleConnected);

	imEventsRegistered = false;
	console.log("[IM] 事件监听器已清理");
};
