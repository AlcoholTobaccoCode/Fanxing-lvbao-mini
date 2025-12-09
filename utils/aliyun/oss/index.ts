import { GetOssSignature, type OssSignatureData } from "@/api/common";
import { randomLenNum } from "@/utils";

// 默认 Bucket 与 Region，可按需调整为你的实际配置
const OSS_BUCKET = "fxzh01";
const OSS_REGION = "oss-cn-hangzhou";

// OSS 直传的完整域名，例如：https://bucket.oss-cn-hangzhou.aliyuncs.com
const OSS_ENDPOINT = `https://${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com`;

/**
 * 生成 OSS 对象存储的 key
 * 默认：app/yyyyMMdd/<随机16位+时间戳>.<ext>
 * 这里的 fileNameOrPath 可以是完整路径或仅文件名
 */
const buildObjectKey = (fileNameOrPath: string, prefix = "app"): string => {
	const rawPath = fileNameOrPath.split("?")[0];
	const name = rawPath.split("/").pop() || "";
	const extMatch = name.match(/\.([^.]+)$/);
	const ext = extMatch ? extMatch[1] : "bin";
	const now = new Date();
	const date = `${now.getFullYear()}${(now.getMonth() + 1)
		.toString()
		.padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}`;
	const rand = randomLenNum(16, true);
	return `${prefix}/${date}/${rand}.${ext}`;
};

export interface UploadOssOptions {
	/** 本地文件路径（如 uni.chooseImage / 录音返回的 tempFilePath） */
	filePath: string;
	/**
	 * 自定义 OSS 对象 key（包含路径），不传则自动生成
	 * 例如："user/avatar/2025/12/09/xxx.jpg"
	 */
	key?: string;
	/**
	 * 当未显式指定 key 时，用于自动 key 生成的前缀目录，默认 "app"
	 */
	dirPrefix?: string;
}

export interface UploadOssResult {
	/** 最终可访问的 OSS URL */
	url: string;
	/** 实际写入 OSS 的对象 key */
	key: string;
	/** uni.uploadFile 原始响应 */
	raw: UniApp.UploadFileSuccessCallbackResult;
}

/**
 * @description 上传文件到阿里云 OSS（表单直传）
 */
export const uploadToOss = async (options: UploadOssOptions): Promise<UploadOssResult> => {
	const { filePath, key, dirPrefix = "app" } = options || {};
	if (!filePath) {
		throw new Error("uploadToOss: filePath 不能为空");
	}

	// 获取后端生成的签名信息
	const sig: OssSignatureData = await GetOssSignature();
	if (!sig) {
		throw new Error("uploadToOss: 获取 OSS 签名失败，data 为空");
	}

	const objectKey = key || buildObjectKey(filePath, dirPrefix);

	const formData: UniApp.UploadFileOption["formData"] = {
		key: objectKey,
		policy: sig.policy,
		"x-oss-signature-version": sig.x_oss_signature_version,
		"x-oss-credential": sig.x_oss_credential,
		"x-oss-date": sig.x_oss_date,
		"x-oss-signature": sig.signature,
		"x-oss-security-token": sig.security_token,
		success_action_status: "200"
	};

	return new Promise<UploadOssResult>((resolve, reject) => {
		uni.uploadFile({
			url: OSS_ENDPOINT,
			filePath,
			name: "file",
			formData,
			success(res) {
				if (res.statusCode === 200 || res.statusCode === 204) {
					const url = `${OSS_ENDPOINT}/${objectKey}`;
					resolve({
						url,
						key: objectKey,
						raw: res
					});
				} else {
					reject(
						new Error(
							`OSS 上传失败，status=${res.statusCode}, data=${typeof res.data === "string" ? res.data : JSON.stringify(res.data)}`
						)
					);
				}
			},
			fail(err) {
				reject(err);
			}
		});
	});
};

export default uploadToOss;
