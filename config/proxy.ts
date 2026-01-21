export const proxy = {
	// 开发环境配置
	dev: {
		// target: "http://127.0.0.1:8000",
		target: "https://lawapi-test.fanxingzhihui.com",
		changeOrigin: true,
		rewrite: (path: string) => path.replace("/dev", "")
	},

	// 生产环境配置
	prod: {
		target: "https://lxf-api.legal-heroes.cn",
		changeOrigin: true,
		rewrite: (path: string) => path.replace("/prod", "")
	}
};

export const value = "dev";
