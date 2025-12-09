import { storage } from "@/cool";
import { GetVoiceToken, type VoiceTokenData } from "@/api/common";

export * from "./tts";

export const APP_KEY = "UU8bWaD9Si5osxLy";

// 本地缓存的 key
const STORAGE_KEY = "aliyun_voice_token";

// 提前 N 秒认为即将过期，避免边界时间请求失败
const EXPIRE_GUARD_SECONDS = 120;

// 统一拿到接口中的过期时间（单位：秒时间戳）
const getExpireTime = (data: VoiceTokenData): number | null => {
	if (typeof data.expire_time === "number") return data.expire_time;
	const rawExpire = data.raw?.Token?.ExpireTime;
	return typeof rawExpire === "number" ? rawExpire : null;
};

// 从本地缓存中读取可用的 token（依赖框架 storage 的过期判断）
const loadCachedVoiceToken = (): VoiceTokenData | null => {
	try {
		// 使用框架封装的过期检测
		if (storage.isExpired(STORAGE_KEY)) {
			return null;
		}
		const value = storage.get(STORAGE_KEY) as VoiceTokenData | null;
		return value ?? null;
	} catch {
		return null;
	}
};

// 写入本地缓存，过期时间按接口返回的 expire_time 计算 TTL
const saveCachedVoiceToken = (data: VoiceTokenData) => {
	try {
		const expireTime = getExpireTime(data);
		if (!expireTime) {
			// 未提供过期时间则按永不过期处理（由后端控制）
			storage.set(STORAGE_KEY, data, 0);
			return;
		}

		const nowSec = Math.floor(Date.now() / 1000);
		let ttl = expireTime - nowSec - EXPIRE_GUARD_SECONDS;
		if (ttl < 0) ttl = 0;

		storage.set(STORAGE_KEY, data, ttl);
	} catch {
		// 静默忽略本地缓存失败
	}
};

/**
 * 获取一个当前有效的语音 Token：
 * 1. 先尝试从本地缓存读取，校验未过期则直接返回
 * 2. 否则调用后端 /utils/voice/token 接口获取新的 Token，并写入本地缓存
 */
export const getValidVoiceToken = async (): Promise<VoiceTokenData> => {
	const cached = loadCachedVoiceToken();
	if (cached) return cached;

	const fresh = await GetVoiceToken();
	if (fresh) {
		saveCachedVoiceToken(fresh);
	}
	return fresh;
};
