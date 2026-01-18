/**
 * 设备信息工具类
 * 提供设备类型检测、安全区域、屏幕尺寸等功能
 */

// 系统信息缓存
let systemInfo: UniApp.GetSystemInfoResult | null = null;

/**
 * 获取系统信息（带缓存）
 */
const getSystemInfo = (): UniApp.GetSystemInfoResult => {
	if (!systemInfo) {
		systemInfo = uni.getSystemInfoSync();
	}
	return systemInfo;
};

/**
 * 设备类型枚举
 */
export enum DeviceType {
	IOS = "ios",
	ANDROID = "android",
	WINDOWS = "windows",
	MAC = "mac",
	LINUX = "linux",
	UNKNOWN = "unknown"
}

/**
 * 设备信息接口
 */
export interface DeviceInfo {
	type: DeviceType; // 设备类型
	platform: string; // 平台名称
	system: string; // 操作系统版本
	model: string; // 设备型号
	brand: string; // 设备品牌
	isIOS: boolean; // 是否为 iOS
	isAndroid: boolean; // 是否为 Android
	isDesktop: boolean; // 是否为桌面端
	isMobile: boolean; // 是否为移动端
}

/**
 * 安全区域信息接口
 */
export interface SafeAreaInfo {
	top: number; // 顶部安全区域高度（px）
	bottom: number; // 底部安全区域高度（px）
	left: number; // 左侧安全区域宽度（px）
	right: number; // 右侧安全区域宽度（px）
	statusBarHeight: number; // 状态栏高度（px）
}

/**
 * 屏幕尺寸信息接口
 */
export interface ScreenInfo {
	width: number; // 屏幕宽度（px）
	height: number; // 屏幕高度（px）
	windowWidth: number; // 可使用窗口宽度（px）
	windowHeight: number; // 可使用窗口高度（px）
	pixelRatio: number; // 设备像素比
	screenWidth: number; // 屏幕宽度（px）
	screenHeight: number; // 屏幕高度（px）
}

/**
 * 获取设备类型
 */
const getDeviceType = (platform: string): DeviceType => {
	const p = platform.toLowerCase();
	if (p.includes("ios") || p.includes("iphone") || p.includes("ipad")) {
		return DeviceType.IOS;
	}
	if (p.includes("android")) {
		return DeviceType.ANDROID;
	}
	if (p.includes("windows")) {
		return DeviceType.WINDOWS;
	}
	if (p.includes("mac")) {
		return DeviceType.MAC;
	}
	if (p.includes("linux")) {
		return DeviceType.LINUX;
	}
	return DeviceType.UNKNOWN;
};

/**
 * 获取设备信息
 */
export const getDeviceInfo = (): DeviceInfo => {
	const info = getSystemInfo();
	const type = getDeviceType(info.platform);

	return {
		type,
		platform: info.platform,
		system: info.system,
		model: info.model || "",
		brand: info.brand || "",
		isIOS: type === DeviceType.IOS,
		isAndroid: type === DeviceType.ANDROID,
		isDesktop: type === DeviceType.WINDOWS || type === DeviceType.MAC || type === DeviceType.LINUX,
		isMobile: type === DeviceType.IOS || type === DeviceType.ANDROID
	};
};

/**
 * 获取安全区域信息
 */
export const getSafeAreaInfo = (): SafeAreaInfo => {
	const info = getSystemInfo();
	const safeArea = info.safeArea || {
		top: 0,
		bottom: info.screenHeight || 0,
		left: 0,
		right: info.screenWidth || 0
	};
	const safeAreaInsets = info.safeAreaInsets || {
		top: 0,
		bottom: 0,
		left: 0,
		right: 0
	};

	return {
		top: safeAreaInsets.top || safeArea.top || 0,
		bottom: safeAreaInsets.bottom || 0,
		left: safeAreaInsets.left || safeArea.left || 0,
		right: safeAreaInsets.right || 0,
		statusBarHeight: info.statusBarHeight || 0
	};
};

/**
 * 获取屏幕尺寸信息
 */
export const getScreenInfo = (): ScreenInfo => {
	const info = getSystemInfo();

	return {
		width: info.screenWidth || 0,
		height: info.screenHeight || 0,
		windowWidth: info.windowWidth || 0,
		windowHeight: info.windowHeight || 0,
		pixelRatio: info.pixelRatio || 1,
		screenWidth: info.screenWidth || 0,
		screenHeight: info.screenHeight || 0
	};
};

/**
 * 判断是否为 iOS 设备
 */
export const isIOS = (): boolean => {
	return getDeviceInfo().isIOS;
};

/**
 * 判断是否为 Android 设备
 */
export const isAndroid = (): boolean => {
	return getDeviceInfo().isAndroid;
};

/**
 * 判断是否为移动端设备
 */
export const isMobile = (): boolean => {
	return getDeviceInfo().isMobile;
};

/**
 * 判断是否为桌面端设备
 */
export const isDesktop = (): boolean => {
	return getDeviceInfo().isDesktop;
};

/**
 * 获取状态栏高度
 */
export const getStatusBarHeight = (): number => {
	return getSafeAreaInfo().statusBarHeight;
};

/**
 * 获取顶部安全区域高度
 */
export const getTopSafeArea = (): number => {
	return getSafeAreaInfo().top;
};

/**
 * 获取底部安全区域高度
 */
export const getBottomSafeArea = (): number => {
	return getSafeAreaInfo().bottom;
};

