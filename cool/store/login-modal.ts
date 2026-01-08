import { ref } from "vue";

/**
 * 全局登录弹窗管理
 * 用于在任何地方触发登录弹窗，并在登录成功后执行回调
 */

// 登录弹窗显示状态
export const loginModalVisible = ref(false);

// 登录成功后的回调队列
type LoginCallback = () => void | Promise<void>;
const loginCallbacks: LoginCallback[] = [];

/**
 * 显示登录弹窗
 * @param onSuccess 登录成功后的回调函数
 */
export function showLoginModal(onSuccess?: LoginCallback) {
	loginModalVisible.value = true;
	if (onSuccess) {
		loginCallbacks.push(onSuccess);
	}
}

/**
 * 隐藏登录弹窗
 */
export function hideLoginModal() {
	loginModalVisible.value = false;
}

/**
 * 登录成功时调用，执行所有回调
 */
export async function onLoginSuccess() {
	// 执行所有回调
	while (loginCallbacks.length > 0) {
		const callback = loginCallbacks.shift();
		if (callback) {
			try {
				await callback();
				// 关闭弹窗
				hideLoginModal();
			} catch (error) {
				console.error("Login callback error:", error);
			}
		}
	}
	// 关闭弹窗
	hideLoginModal();
}

/**
 * 登录取消/关闭时调用，清空回调队列
 */
export function onLoginCancel() {
	// 清空回调队列
	loginCallbacks.length = 0;
	hideLoginModal();
}
