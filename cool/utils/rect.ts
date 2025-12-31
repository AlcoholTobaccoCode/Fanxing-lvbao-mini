import { config } from "@/config";
import { router } from "../router";
import { isH5, isHarmony } from "./device";
import { ctx } from "../ctx";
import { getPx } from "./parse";

/**
 * 是否需要计算 tabBar 高度
 * @returns boolean
 */
export function hasCustomTabBar() {
	if (router.isTabPage()) {
		if (isHarmony()) {
			return false;
		}

		return config.isCustomTabBar || isH5();
	}

	return false;
}

/**
 * 是否存在自定义 topbar
 * @returns boolean
 */
export function hasCustomTopbar() {
	return router.route()?.isCustomNavbar ?? false;
}

// 缓存安全区高度，避免重复获取和 0 值问题
let _cachedSafeAreaTop: number | null = null;
let _cachedSafeAreaBottom: number | null = null;

/**
 * 获取安全区域高度（带缓存和 fallback）
 * @param type 类型
 * @returns 安全区域高度
 */
export function getSafeAreaHeight(type: "top" | "bottom") {
	// 检查缓存
	if (type === "top" && _cachedSafeAreaTop !== null && _cachedSafeAreaTop > 0) {
		return _cachedSafeAreaTop;
	}
	if (type === "bottom" && _cachedSafeAreaBottom !== null && _cachedSafeAreaBottom > 0) {
		return _cachedSafeAreaBottom;
	}

	let h = 0;

	// 优先使用 getWindowInfo
	try {
		const windowInfo = uni.getWindowInfo();
		if (windowInfo?.safeAreaInsets) {
			h = type === "top" ? windowInfo.safeAreaInsets.top : windowInfo.safeAreaInsets.bottom;
		}
	} catch (e) {
		// ignore
	}

	// fallback: 使用 getSystemInfoSync
	if (h === 0) {
		try {
			const sysInfo = uni.getSystemInfoSync();
			if (type === "top") {
				// statusBarHeight 是状态栏高度，通常等于或接近 safe-area-inset-top
				h = sysInfo.statusBarHeight ?? 0;
			} else {
				// 底部安全区从 safeAreaInsets 或 screenHeight - safeArea.bottom 计算
				if (sysInfo.safeAreaInsets) {
					h = sysInfo.safeAreaInsets.bottom ?? 0;
				} else if (sysInfo.safeArea && sysInfo.screenHeight) {
					h = sysInfo.screenHeight - sysInfo.safeArea.bottom;
				}
			}
		} catch (e) {
			// ignore
		}
	}

	// 最终 fallback: 给一个合理的默认值
	if (type === "top" && h === 0) {
		// #ifdef APP-IOS
		h = 47; // iPhone 刘海屏常见值
		// #endif
		// #ifdef MP-WEIXIN
		h = 44; // 微信小程序状态栏默认高度
		// #endif
	}

	if (type === "bottom") {
		// #ifdef APP-ANDROID
		if (h === 0) {
			h = 16;
		}
		// #endif
		// #ifdef APP-IOS
		if (h === 0) {
			h = 34; // iPhone 底部安全区常见值
		}
		// #endif
	}

	// 缓存有效值
	if (h > 0) {
		if (type === "top") {
			_cachedSafeAreaTop = h;
		} else {
			_cachedSafeAreaBottom = h;
		}
	}

	return h;
}

/**
 * 重置安全区域缓存（用于屏幕旋转等场景）
 */
export function resetSafeAreaCache() {
	_cachedSafeAreaTop = null;
	_cachedSafeAreaBottom = null;
}

/**
 * 获取 tabBar 高度
 * @returns tabBar 高度
 */
export function getTabBarHeight() {
	let h = ctx.tabBar.height == null ? 50 : getPx(ctx.tabBar.height!);

	if (hasCustomTabBar()) {
		h += getSafeAreaHeight("bottom");
	}

	return h;
}
