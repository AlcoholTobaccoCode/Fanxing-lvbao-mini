/**
 * 权限管理工具
 * 提供统一的权限申请、检查和管理功能
 */

// ==================== 类型定义 ====================

/**
 * 权限类型枚举
 */
export enum PermissionScope {
	/** 相机权限 */
	CAMERA = "scope.camera",
	/** 录音权限 */
	RECORD = "scope.record",
	/** 位置权限 */
	LOCATION = "scope.userLocation",
	/** 相册权限 */
	ALBUM = "scope.writePhotosAlbum",
	/** 通讯地址 */
	ADDRESS = "scope.address",
	/** 发票抬头 */
	INVOICE = "scope.invoiceTitle",
	/** 微信运动步数 */
	STEP = "scope.werun",
	/** 蓝牙 */
	BLUETOOTH = "scope.bluetooth"
}

/**
 * 权限配置信息
 */
export interface PermissionConfig {
	/** 权限标识 */
	scope: PermissionScope | string;
	/** 权限名称 */
	name: string;
	/** 权限描述 */
	description: string;
	/** 设置提示文案 */
	settingTip: string;
}

/**
 * 权限申请结果
 */
export interface PermissionResult {
	/** 是否成功获得权限 */
	success: boolean;
	/** 权限状态：authorized(已授权) | denied(已拒绝) | not_determined(未询问) | error(错误) */
	status: "authorized" | "denied" | "not_determined" | "error";
	/** 错误或提示信息 */
	message?: string;
}

/**
 * 权限申请选项
 */
export interface RequestPermissionOptions {
	/** 权限范围 */
	scope: PermissionScope | string;
	/** 自定义权限名称 */
	customName?: string;
	/** 自定义描述文案 */
	customDescription?: string;
	/** 是否显示确认弹窗（默认 true） */
	showConfirm?: boolean;
	/** 拒绝后的回调 */
	onDenied?: () => void;
	/** 成功后的回调 */
	onSuccess?: () => void;
	/** 自定义日志记录器 */
	logger?: {
		info: (message: string, ...args: any[]) => void;
		warn: (message: string, ...args: any[]) => void;
		error: (message: string, ...args: any[]) => void;
	};
	/** 自定义 UI 提示 */
	ui?: {
		showToast: (options: { message: string; icon?: string }) => void;
	};
}

// ==================== 权限配置 ====================

/**
 * 权限配置映射表
 */
export const PERMISSION_CONFIG_MAP: Record<string, PermissionConfig> = {
	[PermissionScope.CAMERA]: {
		scope: PermissionScope.CAMERA,
		name: "相机权限",
		description: "需要使用您的相机进行拍照或扫码",
		settingTip: "请前往设置页面开启相机权限"
	},
	[PermissionScope.RECORD]: {
		scope: PermissionScope.RECORD,
		name: "录音权限",
		description: "需要使用您的麦克风进行语音输入",
		settingTip: "请前往设置页面开启麦克风权限"
	},
	[PermissionScope.LOCATION]: {
		scope: PermissionScope.LOCATION,
		name: "位置权限",
		description: "需要获取您的地理位置",
		settingTip: "请前往设置页面开启位置权限"
	},
	[PermissionScope.ALBUM]: {
		scope: PermissionScope.ALBUM,
		name: "相册权限",
		description: "需要保存图片到您的相册",
		settingTip: "请前往设置页面开启相册权限"
	},
	[PermissionScope.ADDRESS]: {
		scope: PermissionScope.ADDRESS,
		name: "通讯地址权限",
		description: "需要获取您的通讯地址",
		settingTip: "请前往设置页面开启通讯地址权限"
	},
	[PermissionScope.INVOICE]: {
		scope: PermissionScope.INVOICE,
		name: "发票抬头权限",
		description: "需要获取您的发票抬头信息",
		settingTip: "请前往设置页面开启发票抬头权限"
	},
	[PermissionScope.STEP]: {
		scope: PermissionScope.STEP,
		name: "微信运动权限",
		description: "需要获取您的微信运动步数",
		settingTip: "请前往设置页面开启微信运动权限"
	},
	[PermissionScope.BLUETOOTH]: {
		scope: PermissionScope.BLUETOOTH,
		name: "蓝牙权限",
		description: "需要使用您的蓝牙功能",
		settingTip: "请前往设置页面开启蓝牙权限"
	}
};

// ==================== 工具方法 ====================

/**
 * 默认日志记录器
 */
const defaultLogger = {
	info: (message: string, ...args: any[]) => console.log(`[Permission] ${message}`, ...args),
	warn: (message: string, ...args: any[]) => console.warn(`[Permission] ${message}`, ...args),
	error: (message: string, ...args: any[]) => console.error(`[Permission] ${message}`, ...args)
};

/**
 * 默认 UI 提示
 */
const defaultUI = {
	showToast: (options: { message: string; icon?: string }) => {
		uni.showToast({
			title: options.message,
			icon: options.icon === "success" ? "success" : options.icon === "error" ? "error" : "none",
			duration: 2000
		});
	}
};

/**
 * 通用权限申请方法
 * @param options 权限申请选项
 * @returns Promise<PermissionResult>
 *
 * @example
 * ```ts
 * // 基础用法
 * const result = await requestPermission({
 *   scope: PermissionScope.CAMERA
 * });
 *
 * // 自定义配置
 * const result = await requestPermission({
 *   scope: PermissionScope.CAMERA,
 *   customName: "相机",
 *   showConfirm: false,
 *   onSuccess: () => console.log("授权成功"),
 *   onDenied: () => console.log("授权被拒绝")
 * });
 * ```
 */
export const requestPermission = (options: RequestPermissionOptions): Promise<PermissionResult> => {
	return new Promise((resolve) => {
		const {
			scope,
			customName,
			customDescription,
			showConfirm = true,
			onDenied,
			onSuccess,
			logger = defaultLogger,
			ui = defaultUI
		} = options;

		// 获取权限配置
		const config = PERMISSION_CONFIG_MAP[scope] || {
			scope,
			name: customName || "权限",
			description: customDescription || "需要获取相关权限",
			settingTip: `请前往设置页面开启${customName || "相关"}权限`
		};

		logger.info(`开始申请权限: ${config.name}`, scope);

		// 1. 检查权限状态
		uni.getSetting({
			success: (settingRes) => {
				const authStatus = settingRes.authSetting[scope];

				logger.info(`权限状态: ${config.name}`, authStatus);

				// 情况1: 已授权
				if (authStatus === true) {
					logger.info(`权限已授权: ${config.name}`);
					onSuccess?.();
					resolve({
						success: true,
						status: "authorized",
						message: "权限已授权"
					});
					return;
				}

				// 情况2: 已拒绝（需要引导用户去设置）
				if (authStatus === false) {
					logger.warn(`权限已被拒绝: ${config.name}`);
					uni.showModal({
						title: "权限提示",
						content: config.settingTip,
						confirmText: "去设置",
						cancelText: "取消",
						success: (modalRes) => {
							if (modalRes.confirm) {
								// 打开设置页面
								uni.openSetting({
									success: (openRes) => {
										// 检查用户是否开启了权限
										if (openRes.authSetting[scope]) {
											logger.info(`用户在设置中开启了权限: ${config.name}`);
											ui.showToast({
												message: "权限已开启",
												icon: "success"
											});
											onSuccess?.();
											resolve({
												success: true,
												status: "authorized",
												message: "用户在设置中开启了权限"
											});
										} else {
											logger.warn(`用户未在设置中开启权限: ${config.name}`);
											ui.showToast({ message: "未开启权限", icon: "error" });
											onDenied?.();
											resolve({
												success: false,
												status: "denied",
												message: "用户未在设置中开启权限"
											});
										}
									},
									fail: () => {
										logger.error(`打开设置页面失败: ${config.name}`);
										onDenied?.();
										resolve({
											success: false,
											status: "denied",
											message: "打开设置页面失败"
										});
									}
								});
							} else {
								// 用户取消去设置
								logger.warn(`用户拒绝去设置: ${config.name}`);
								onDenied?.();
								resolve({
									success: false,
									status: "denied",
									message: "用户拒绝去设置"
								});
							}
						}
					});
					return;
				}

				// 情况3: 未询问过（首次申请）
				logger.info(`首次申请权限: ${config.name}`);

				// 执行授权
				const doAuthorize = () => {
					uni.authorize({
						scope,
						success: () => {
							logger.info(`权限申请成功: ${config.name}`);
							ui.showToast({ message: "授权成功", icon: "success" });
							onSuccess?.();
							resolve({
								success: true,
								status: "authorized",
								message: "权限申请成功"
							});
						},
						fail: (err) => {
							logger.error(`权限申请失败: ${config.name}`, err);
							ui.showToast({ message: "授权失败", icon: "error" });
							onDenied?.();
							resolve({
								success: false,
								status: "denied",
								message: err.errMsg || "权限申请失败"
							});
						}
					});
				};

				// 如果需要显示确认弹窗
				if (showConfirm) {
					uni.showModal({
						title: `申请${config.name}`,
						content: config.description,
						confirmText: "同意",
						cancelText: "拒绝",
						success: (modalRes) => {
							if (modalRes.confirm) {
								doAuthorize();
							} else {
								logger.warn(`用户拒绝授权: ${config.name}`);
								onDenied?.();
								resolve({
									success: false,
									status: "denied",
									message: "用户拒绝授权"
								});
							}
						}
					});
				} else {
					doAuthorize();
				}
			},
			fail: (err) => {
				logger.error(`获取权限设置失败: ${config.name}`, err);
				ui.showToast({ message: "获取权限设置失败", icon: "error" });
				resolve({
					success: false,
					status: "error",
					message: err.errMsg || "获取权限设置失败"
				});
			}
		});
	});
};

/**
 * 检查权限状态（不申请）
 * @param scope 权限范围
 * @returns Promise<boolean> 是否已授权
 *
 * @example
 * ```ts
 * const hasPermission = await checkPermission(PermissionScope.CAMERA);
 * if (hasPermission) {
 *   // 已有权限，执行操作
 * }
 * ```
 */
export const checkPermission = (scope: PermissionScope | string): Promise<boolean> => {
	return new Promise((resolve) => {
		uni.getSetting({
			success: (res) => {
				resolve(res.authSetting[scope] === true);
			},
			fail: () => {
				resolve(false);
			}
		});
	});
};

/**
 * 打开系统设置页面
 *
 * @example
 * ```ts
 * openSettings();
 * ```
 */
export const openSettings = (): Promise<boolean> => {
	return new Promise((resolve) => {
		uni.openSetting({
			success: () => {
				resolve(true);
			},
			fail: () => {
				resolve(false);
			}
		});
	});
};

/**
 * 批量检查权限
 * @param scopes 权限范围数组
 * @returns Promise<Record<string, boolean>> 权限状态映射表
 *
 * @example
 * ```ts
 * const permissions = await checkMultiplePermissions([
 *   PermissionScope.CAMERA,
 *   PermissionScope.RECORD
 * ]);
 * console.log(permissions); // { 'scope.camera': true, 'scope.record': false }
 * ```
 */
export const checkMultiplePermissions = async (
	scopes: (PermissionScope | string)[]
): Promise<Record<string, boolean>> => {
	return new Promise((resolve) => {
		uni.getSetting({
			success: (res) => {
				const result: Record<string, boolean> = {};
				scopes.forEach((scope) => {
					result[scope] = res.authSetting[scope] === true;
				});
				resolve(result);
			},
			fail: () => {
				const result: Record<string, boolean> = {};
				scopes.forEach((scope) => {
					result[scope] = false;
				});
				resolve(result);
			}
		});
	});
};

/**
 * 批量申请权限
 * @param scopes 权限范围数组
 * @param options 申请选项（应用于所有权限）
 * @returns Promise<Record<string, PermissionResult>> 权限申请结果映射表
 *
 * @example
 * ```ts
 * const results = await requestMultiplePermissions([
 *   PermissionScope.CAMERA,
 *   PermissionScope.RECORD
 * ], {
 *   showConfirm: false
 * });
 * ```
 */
export const requestMultiplePermissions = async (
	scopes: (PermissionScope | string)[],
	options?: Omit<RequestPermissionOptions, "scope">
): Promise<Record<string, PermissionResult>> => {
	const results: Record<string, PermissionResult> = {};

	for (const scope of scopes) {
		const result = await requestPermission({
			...options,
			scope
		});
		results[scope] = result;
	}

	return results;
};
