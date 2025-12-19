import { get } from "@/cool";
import { proxy } from "./proxy";

export const prod = () => {
	const host = get(proxy, `prod.target`) as string;

	let baseUrl: string;

	// #ifdef H5
	baseUrl = host + "/";
	// #endif

	// #ifndef H5
	baseUrl = host + "";
	// #endif

	const voiceCallUrl = "https://voicecall.fanxingzhihui.com/";

	return {
		host,
		baseUrl,
		voiceCallUrl
	};
};
