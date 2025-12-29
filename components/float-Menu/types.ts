export interface BtnListItem {
	text: string; // 菜单名称
	icon?: string; // 图标
	menuBgColor?: string; // 菜单背景颜色
	textColor?: string; // 菜单名称颜色
	iconColor?: string; // 菜单图标颜色
	cb?: Function; // 点击回调
	badge?: boolean; // 是否展示徽标(默认为 number 且 > 0 时展示， string 常显， 该参数大于默认规则)
	badgeVal?: string | number; // 徽标
}
