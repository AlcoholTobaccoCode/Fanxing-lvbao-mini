export type ToolItem = {
	icon: string;
	text: string;
	enable?: boolean;
	color?: string;
	onClick?: (item: ToolItem) => void;
};

export type Tools = ToolItem[];

export type ActionItem = {
	icon: string;
	text: string;
	disabled: boolean;
	onClick: (item: ActionItem) => void;
};

export type Actions = ActionItem[];

export type VoiceResult = {
	buffer: ArrayBuffer;
	duration: number;
	mime: string;
	translate?: boolean;
	// 临时地址
	tempFilePath?: string;
	// 线上地址
	onlineUrl?: string;
	// 语音文本
	text?: string;
};

export type SendData = {
	text: string;
	mode?: "text" | "voice";
	voice?: VoiceResult;
};

export type ActionItems = "camera" | "album" | "file" | "wechat" | "phoneCall";

export type InputLine = {
	height: number;
	lineCount: number;
	lineHeight: number;
};
