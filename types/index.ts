export type UserInfo = {
	id: number; // 用户id
	nickName: string; // 昵称
	avatarUrl?: string; // 头像
	phone: string; // 手机号
	gender: number; // 性别
	status: number; // 状态
	description?: string; // 描述
	loginType: number; // 登录类型
	province?: string; // 省份
	city?: string; // 城市
	district?: string; // 区县
	birthday?: string; // 生日
	createTime: string; // 创建时间
	updateTime: string; // 更新时间
	userType: number; // 用户类型
};
