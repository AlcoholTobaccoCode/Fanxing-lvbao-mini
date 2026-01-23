import { get } from "@/cool";
import { proxy, value } from "./proxy";

export const dev = () => {
	const host = get(proxy, `${value}.target`) as string;

	let baseUrl: string;

	// #ifdef H5
	baseUrl = `/${value}`;
	// #endif

	// #ifndef H5
	baseUrl = host + "";
	// #endif

	const hxImDebug = true;

	const voiceCallUrl = "https://voicecall.fanxingzhihui.com/";
	// const voiceCallUrl = "http://localhost:5173";

	const fileUploadUrl = "https://voicecall.fanxingzhihui.com/";
	// const fileUploadUrl = "http://localhost:3001/";
	// const fileUploadUrl = "http://192.168.3.13:3001/";

	return {
		host,
		baseUrl,
		hxImDebug,
		voiceCallUrl,
		fileUploadUrl
	};
};
