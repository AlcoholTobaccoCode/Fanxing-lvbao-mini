export type LoginByPassword = {
	// 密码
	password: string;
	// 手机号码
	phone: string;
};

export type LoginByCode = {
	// 验证码
	code: string;
	// 手机号码
	phone: string;
};

export type Register = {
	// 验证码
	code: string;
	// 密码
	password: string;
	// 手机号
	phone: string;
	// 用户名
	username?: string;
};
