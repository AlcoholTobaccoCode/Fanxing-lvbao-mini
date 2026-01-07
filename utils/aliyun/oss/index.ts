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

/**
 * 根据文件扩展名获取 MIME 类型
 */
const getMimeType = (fileName: string): string => {
	const ext = fileName.split(".").pop()?.toLowerCase() || "";
	const mimeMap: Record<string, string> = {
		// 文档
		pdf: "application/pdf",
		doc: "application/msword",
		docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		// 图片
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		webp: "image/webp",
		// 文本
		txt: "text/plain",
		md: "text/markdown",
		// 音频
		mp3: "audio/mpeg",
		wav: "audio/wav",
		// 视频
		mp4: "video/mp4",
		avi: "video/x-msvideo"
	};
	return mimeMap[ext] || "application/octet-stream";
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

/**
 * 文件扩展信息
 */
export interface FileExtInfo {
	/** MIME 类型 */
	mimeType: string;
	/** 文件大小（字节） */
	sizeBytes: number;
	/** SHA256 哈希值（可选） */
	sha256?: string;
	/** OSS URL */
	oss_url: string;
}

export interface UploadOssResult {
	/** 最终可访问的 OSS URL */
	url: string;
	/** 实际写入 OSS 的对象 key */
	key: string;
	/** uni.uploadFile 原始响应 */
	raw: UniApp.UploadFileSuccessCallbackResult;
	/** 文件扩展信息 */
	ext: FileExtInfo;
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

	// 获取文件信息
	const getFileInfo = (): Promise<{ size: number }> => {
		return new Promise((resolve, reject) => {
			uni.getFileInfo({
				filePath,
				success: (res) => {
					resolve({ size: res.size });
				},
				fail: (err) => {
					// 如果获取失败，返回默认值
					console.warn("获取文件信息失败:", err);
					resolve({ size: 0 });
				}
			});
		});
	};

	// 获取文件大小
	const fileInfo = await getFileInfo();

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

					// 构建扩展信息
					const ext: FileExtInfo = {
						mimeType: getMimeType(filePath),
						sizeBytes: fileInfo.size,
						oss_url: url
					};

					resolve({
						url,
						key: objectKey,
						raw: res,
						ext
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
