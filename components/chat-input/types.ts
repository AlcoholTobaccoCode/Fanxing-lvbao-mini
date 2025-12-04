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

export type SendData = {
	text: string;
};
