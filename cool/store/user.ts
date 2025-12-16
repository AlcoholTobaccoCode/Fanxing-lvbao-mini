import { computed, ref } from "vue";
import { forInObject, isNull, isObject, parse, storage } from "../utils";
import { router } from "../router";
import { request } from "../service";
import { GetUserProfile } from "@/api/user";
import type { UserInfo } from "@/types";
import { clearEasemobCache, ensureGlobalIMForUser } from "@/utils/easemob";
import { imStore } from "./im";

// 登录成功返回的认证信息
// 对应后端 data: { access_token, token_type, userType, phone, username }
export type Token = {
	access_token: string; // 访问 token，例如 "Bearer xxx"
	token_type: string; // token 类型，通常为 "bearer"
	userType: number; // 用户类型
	phone: string; // 手机号
	username: string; // 用户名
};

export class User {
	/**
	 * 用户信息，响应式对象
	 */
	info = ref<UserInfo | null>(null);

	/**
	 * 当前token，字符串或null
	 */
	token: string | null = null;

	constructor() {
		// 获取本地用户信息
		const userInfo = storage.get("userInfo");

		// 获取本地token
		const token = storage.get("token") as string | null;

		// 如果token为空字符串则置为null
		this.token = token == "" ? null : token;

		// 初始化用户信息
		if (userInfo != null && isObject(userInfo)) {
			this.set(userInfo);
		}
	}

	/**
	 * 获取用户信息（从服务端拉取最新信息并更新本地）
	 * @returns Promise<void>
	 */
	async get() {
		if (this.token != null) {
			await GetUserProfile()
				.then((res) => {
					if (res != null) {
						this.set(res);
						// 登录成功自动注册环信 IM
						const uid = String(res.id);
						ensureGlobalIMForUser(uid).catch((err) => {
							console.error("[IM] 登录时初始化失败", err);
						});
					}
				})
				.catch(() => {
					// this.logout();
				});
		}
	}

	/**
	 * 设置用户信息并存储到本地
	 * @param data 用户信息对象
	 */
	set(data: any) {
		if (isNull(data)) {
			return;
		}

		let info: UserInfo;

		// 兼容后端新返回结构：{ id, username, phone, user_type, gender, avatar_url, created_at, updated_at }
		if (
			"username" in data ||
			"user_type" in data ||
			"avatar_url" in data ||
			"created_at" in data
		) {
			const genderRaw = Number(data.gender ?? 0);
			const gender = genderRaw === 1 || genderRaw === 2 ? genderRaw : 0; // 0=保密，其它映射为保密

			info = {
				id: Number(data.id ?? 0),
				nickName: data.username ?? "",
				avatarUrl: data.avatar_url ?? "",
				phone: data.phone ?? "",
				gender,
				userType: data.user_type ?? "",
				loginType: Number(data.user_type ?? data.userType ?? 1),
				createTime: data.created_at ?? data.createTime ?? "",
				updateTime: data.updated_at ?? data.updateTime ?? "",
				// 预留
				description: data.description ?? "",
				province: data.province ?? "",
				city: data.city ?? "",
				district: data.district ?? "",
				birthday: data.birthday ?? "",
				status: 1
			};
		} else {
			// 已经是前端 UserInfo 结构（例如 setToken 中构造的对象）
			info = parse<UserInfo>(data)!;
		}

		// 设置
		this.info.value = info;

		// 持久化到本地存储（使用归一化后的结构）
		storage.set("userInfo", info, 0);
	}

	/**
	 * 更新用户信息（本地与服务端同步）
	 * @param data 新的用户信息
	 */
	async update(data: any) {
		if (isNull(data) || isNull(this.info.value)) {
			return;
		}

		// 本地同步更新
		forInObject(data, (value, key) => {
			this.info.value![key] = value;
		});

		// 同步到服务端
		await request({
			url: "/app/user/info/updatePerson",
			method: "POST",
			data
		});
	}

	/**
	 * 移除用户信息
	 */
	remove() {
		this.info.value = null;
		storage.remove("userInfo");
	}

	/**
	 * 判断用户信息是否为空
	 * @returns boolean
	 */
	isNull() {
		return this.info.value == null;
	}

	/**
	 * 清除本地所有用户信息和token
	 */
	clear() {
		storage.remove("userInfo");
		storage.remove("token");
		storage.remove("refreshToken");
		this.token = null;
		this.remove();

		// 清空环信 IM 相关缓存和连接
		clearEasemobCache();

		// 清空 IM store 数据
		imStore.clear();
	}

	/**
	 * 退出登录，清除所有信息并跳转到登录页
	 */
	logout() {
		this.clear();
		router.login();
	}

	/**
	 * 设置token并存储到本地
	 * @param data 登录返回的认证信息
	 */
	setToken(data: Token) {
		// 直接保存 access_token 作为当前 token（不再使用刷新 token 机制）
		this.token = data.access_token;
		// token 永不过期，由服务端在 401 时判定失效
		storage.set("token", data.access_token, 0);

		// 同步一份基础用户信息，便于前端展示昵称、手机号等
		// 其余字段留给后续 /user/profile 等接口覆盖
		this.set({
			unionid: "",
			id: 0,
			nickName: data.username,
			avatarUrl: "",
			phone: data.phone,
			gender: 0,
			status: 1,
			description: "",
			loginType: data.userType,
			province: "",
			city: "",
			district: "",
			birthday: "",
			createTime: "",
			updateTime: ""
		});
	}
}

/**
 * 单例用户对象，项目全局唯一
 */
export const user = new User();

/**
 * 用户信息，响应式对象
 */
export const userInfo = computed(() => user.info.value);
