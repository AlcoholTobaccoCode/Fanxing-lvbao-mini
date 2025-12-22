import { defineConfig } from "vite";
import { cool } from "@cool-vue/vite-plugin";
import { proxy } from "./config/proxy";
import tailwindcss from "tailwindcss";
import { join } from "node:path";
import uni from "@dcloudio/vite-plugin-uni";
import optimizer from "@uni-ku/bundle-optimizer";

const resolve = (dir: string) => join(__dirname, dir);

for (const i in proxy) {
	proxy[`/${i}/`] = proxy[i];
}

export default defineConfig({
	plugins: [
		uni(),
		cool({
			type: "uniapp-x",
			proxy,
			tailwind: {
				enable: true
			}
		}),
		optimizer({
			enable: true,
			logger: true
		})
	],

	server: {
		port: 9900,
		proxy
	},

	css: {
		postcss: {
			plugins: [tailwindcss({ config: resolve("./tailwind.config.ts") })]
		}
	}
});
