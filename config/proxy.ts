export const proxy = {
	// 开发环境配置
	dev: {
		target: "https://lawapi-test.fanxingzhihui.com",
		changeOrigin: true,
		rewrite: (path: string) => path.replace("/dev", "")
	},

	// 生产环境配置
	prod: {
		target: "https://lawapi-test.fanxingzhihui.com",
		changeOrigin: true,
		rewrite: (path: string) => path.replace("/prod", "/api")
	}
};

export const value = "dev";
