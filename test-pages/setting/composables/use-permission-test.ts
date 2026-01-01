import { PermissionScope, requestPermission } from "@/utils/permission";
import { router } from "@/cool";
import { useTestLog } from "./use-test-log";

export function usePermissionTest() {
	const { addLog } = useTestLog();

	const testCameraPermission = async () => {
		addLog("开始申请相机权限...");
		const result = await requestPermission({
			scope: PermissionScope.CAMERA,
			onSuccess: () => {
				addLog("✅ 相机权限申请成功！");
			},
			onDenied: () => {
				addLog("❌ 相机权限被拒绝");
			}
		});
		addLog(`结果: ${JSON.stringify(result)}`);
	};

	const testRecordPermission = async () => {
		addLog("开始申请录音权限...");
		const result = await requestPermission({
			scope: PermissionScope.RECORD,
			onSuccess: () => {
				addLog("✅ 录音权限申请成功！");
			},
			onDenied: () => {
				addLog("❌ 录音权限被拒绝");
			}
		});
		addLog(`结果: ${JSON.stringify(result)}`);
	};

	const testLocationPermission = async () => {
		addLog("开始申请位置权限...");
		const result = await requestPermission({
			scope: PermissionScope.LOCATION,
			onSuccess: () => {
				addLog("✅ 位置权限申请成功！");
			},
			onDenied: () => {
				addLog("❌ 位置权限被拒绝");
			}
		});
		addLog(`结果: ${JSON.stringify(result)}`);
	};

	const testAlbumPermission = async () => {
		addLog("开始申请相册权限...");
		const result = await requestPermission({
			scope: PermissionScope.ALBUM,
			onSuccess: () => {
				addLog("✅ 相册权限申请成功！");
			},
			onDenied: () => {
				addLog("❌ 相册权限被拒绝");
			}
		});
		addLog(`结果: ${JSON.stringify(result)}`);
	};

	const testCustomPermission = async () => {
		addLog("开始申请自定义权限（无确认弹窗）...");
		const result = await requestPermission({
			scope: PermissionScope.CAMERA,
			customName: "自定义相机权限",
			customDescription: "这是一个自定义的权限描述",
			showConfirm: false,
			onSuccess: () => {
				addLog("✅ 自定义权限申请成功！");
			},
			onDenied: () => {
				addLog("❌ 自定义权限被拒绝");
			}
		});
		addLog(`结果: ${JSON.stringify(result)}`);
	};

	const toTestPage = () => {
		router.to("/ai-chat-module/voice-call/index");
	};

	return {
		testCameraPermission,
		testRecordPermission,
		testLocationPermission,
		testAlbumPermission,
		testCustomPermission,
		toTestPage
	};
}
