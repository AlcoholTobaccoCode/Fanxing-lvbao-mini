<script lang="ts" setup>
import { ref, onMounted, watch, computed } from "vue";
import { type BtnListItem } from "./types";
import { unReadCount as imUnReadCount } from "@/cool";

// 定义 props
const props = defineProps({
	disabled: {
		// 是否可以移动，false：可以移动，true：禁止移动
		type: Boolean,
		default: false
	},
	menuItems: {
		// 菜单列表
		type: Array as () => BtnListItem[],
		default: () => []
	},
	buttonBgColor: {
		// 按钮背景颜色
		type: String,
		default: "#fff"
	},
	iconColor: {
		// 按钮图标
		type: String,
		default: "#fff"
	},
	textColor: {
		// 按钮字体颜色
		type: String,
		default: "#fff"
	},
	floatingButtonWidth: {
		// 按钮宽度
		type: String,
		default: "96rpx"
	},
	floatingButtonHeight: {
		// 按钮高度
		type: String,
		default: "96rpx"
	},
	x: {
		// 按钮默认x轴的位置
		type: Number
	},
	y: {
		// 按钮默认y轴的位置
		type: Number
	},
	useMask: {
		type: Boolean,
		default: () => true
	}
});

// 在组件挂载时获取屏幕尺寸
onMounted(() => {
	getScreenSize();
});

// 定义 emits
const emits = defineEmits(["menuClick"]);
const isMenuOpen = ref(false);
const buttonX = ref(props.x);
const buttonY = ref(props.y);
const coordinate = ref(1); // 坐标 1 ：左上角，2：右上角，3：左下角，4：右下角
if (props.x === undefined || props.y === undefined) {
	uni.getSystemInfo().then((res) => {
		// 这里宽高减掉部分，是为了初始化的时候不贴右边，不贴底边
		buttonX.value = props.x ?? res.windowWidth - 80;
		buttonY.value = props.y ?? res.windowHeight - 80;
	});
}

const toggleMenu = () => {
	isMenuOpen.value = !isMenuOpen.value;
	if (isMenuOpen.value) {
		uni.vibrateShort();
	}
};

// 存储 movable-view 的 x 和 y 坐标
const x = ref(0);
const y = ref(0);
// 存储屏幕的宽度和高度
const screenWidth = ref(0);
const screenHeight = ref(0);

// 获取屏幕尺寸
const getScreenSize = () => {
	uni.getSystemInfo({
		success: (res) => {
			screenWidth.value = res.windowWidth;
			screenHeight.value = res.windowHeight;
		}
	});
};

// 处理 movable-view 位置变化的函数
const onMovableChange = (e) => {
	x.value = e.detail.x;
	y.value = e.detail.y;
	const xw = screenWidth.value / 2;
	const yh = screenHeight.value / 2;
	// 判断是否在左上角
	if (x.value <= xw && y.value <= yh) {
		coordinate.value = 1;
	}
	// 判断是否在右上角
	else if (x.value >= xw && y.value <= yh) {
		coordinate.value = 2;
	}
	// 判断是否在左下角
	else if (x.value <= xw && y.value >= yh) {
		coordinate.value = 3;
	}
	// 判断是否在右下角
	else if (x.value >= xw && y.value >= yh) {
		coordinate.value = 4;
	}
};

// 单个菜单大小
const getMenuItemPosition = (index: number) => {
	if (coordinate.value === 1) {
		return topLeftCorner(index);
	} else if (coordinate.value === 2) {
		return topRightCorner(index);
	} else if (coordinate.value === 3) {
		return bottomLeftCorner(index);
	} else {
		return bottomRightCorner(index);
	}
};

// 左上角
const topLeftCorner = (index: number) => {
	const itemCount = props.menuItems.length;
	const radius = 130; // 半圆半径，增大以获得更好的视觉效果
	const startAngle = 110; // 起始角度偏移（原来-10度，逆时针旋转30度变为-40度）
	const angleStep = 180 / (itemCount - 1); // 平均分配180度
	const angle = startAngle + index * angleStep; // 当前项的角度
	const radian = (angle * Math.PI) / 180; // 转换为弧度
	const x = radius * Math.cos(radian) - 120; // 计算x坐标
	const y = radius * Math.sin(radian) - 80; // 计算y坐标
	if (isMenuOpen.value) {
		return `translate(${-x}rpx, ${-y}rpx) scale(1)`;
	}
	return "translate(0, 0) scale(0)";
};

// 悬浮图标右上角显示
const topRightCorner = (index: number) => {
	const itemCount = props.menuItems.length;
	const radius = 130; // 半圆半径，增大以获得更好的视觉效果
	const startAngle = 70; // 起始角度偏移，从右上角开始，顺时针旋转40度
	const angleStep = 180 / (itemCount - 1); // 平均分配180度
	const angle = startAngle + index * angleStep; // 当前项的角度
	const radian = (angle * Math.PI) / 180; // 转换为弧度
	const x = radius * Math.cos(radian) + 30; // 计算x坐标
	const y = radius * Math.sin(radian) + 60; // 计算y坐标
	if (isMenuOpen.value) {
		return `translate(${x}rpx, ${y}rpx) scale(1)`;
	}
	return "translate(0, 0) scale(0)";
};

// 悬浮图标左下角显示
const bottomLeftCorner = (index: number) => {
	const itemCount = props.menuItems.length;
	const radius = 130; // 半圆半径，增大以获得更好的视觉效果
	const startAngle = 50; // 起始角度偏移，从左下角开始，逆时针旋转40度
	const angleStep = 180 / (itemCount - 1); // 平均分配180度
	const angle = startAngle + index * angleStep; // 当前项的角度
	const radian = (angle * Math.PI) / 180; // 转换为弧度
	const x = radius * Math.cos(radian) - 80; // 计算x坐标
	const y = radius * Math.sin(radian) - 30; // 计算y坐标
	if (isMenuOpen.value) {
		return `translate(${-x}rpx, ${-y}rpx) scale(1)`;
	}
	return "translate(0, 0) scale(0)";
};

// 悬浮图标右下角显示
const bottomRightCorner = (index: number) => {
	const itemCount = props.menuItems.length;
	const radius = 130; // 半圆半径，增大以获得更好的视觉效果
	const startAngle = -40; // 起始角度偏移（原来-10度，逆时针旋转30度变为-40度）
	const angleStep = 180 / (itemCount - 1); // 平均分配180度
	const angle = startAngle + index * angleStep; // 当前项的角度
	const radian = (angle * Math.PI) / 180; // 转换为弧度
	const x = radius * Math.cos(radian); // 计算x坐标
	const y = radius * Math.sin(radian); // 计算y坐标
	if (isMenuOpen.value) {
		return `translate(${-x}rpx, ${-y}rpx) scale(1)`;
	}
	return "translate(0, 0) scale(0)";
};

const handleMenuClick = (item: { text: string }) => {
	toggleMenu();
	emits("menuClick", item);
};

//#region IM 相关
// 菜单子项 - 判断是否显示 badge
const handleShowBadge = (item: BtnListItem) => {
	if (item.badge === false) {
		return false;
	}
	const val = item.badgeVal;
	if (val === undefined || val === null || val === "" || val === 0) {
		return false;
	}
	return true;
};

// 全局
// 格式化未读消息数（99+）
const unReadCountText = computed(() => {
	const count = imUnReadCount.value;
	if (count <= 0) return "";
	if (count > 99) return "99+";
	return String(count);
});

// 是否显示未读角标
const showUnReadBadge = computed(() => imUnReadCount.value > 0);
//#endregion
</script>
<template>
	<view>
		<!-- 遮罩层 -->
		<view
			v-if="useMask"
			class="mask"
			:class="{ 'mask-show': isMenuOpen }"
			@click="toggleMenu"
		></view>
		<movable-area class="movable-area">
			<movable-view
				class="movable-view"
				inertia
				:disabled="disabled"
				:x="buttonX"
				:y="buttonY"
				:style="{ width: floatingButtonWidth, height: floatingButtonHeight }"
				direction="all"
				@change="onMovableChange"
			>
				<!-- 悬浮按钮和菜单 -->
				<view class="floating-container">
					<!-- 半圆形菜单 -->
					<view class="menu-container" :class="{ 'menu-open': isMenuOpen }">
						<view
							v-for="(item, index) in menuItems"
							:key="index"
							class="menu-item"
							:style="{
								transform: getMenuItemPosition(index),
								transitionDelay: `${index * 50}ms`
							}"
							@click="handleMenuClick(item)"
						>
							<view
								class="menu-item-inner"
								:style="{ background: item.menuBgColor || buttonBgColor }"
							>
								<cl-icon
									:name="item.icon"
									:color="item.iconColor || iconColor"
								></cl-icon>
								<text
									class="menu-item-text"
									:style="{ color: item.textColor || textColor }"
									>{{ item.text }}</text
								>
								<cl-badge
									v-if="handleShowBadge(item)"
									type="error"
									:value="item.badgeVal"
									position
									:pt="{
										className: '!top-[2px] !right-[16px] p-2'
									}"
								>
								</cl-badge>
							</view>
						</view>
					</view>
					<!-- 悬浮按钮 -->
					<view
						class="floating-button"
						:class="{ 'button-active': isMenuOpen }"
						@click="toggleMenu"
						:style="{
							background: buttonBgColor,
							width: floatingButtonWidth,
							height: floatingButtonHeight
						}"
					>
						<cl-icon
							:name="isMenuOpen ? 'close-line' : 'add-line'"
							:size="48"
						></cl-icon>
						<cl-badge
							v-if="!isMenuOpen && showUnReadBadge"
							type="error"
							:value="unReadCountText"
							position
							:pt="{
								className: '!top-[2px] !right-[16px] p-2'
							}"
						>
						</cl-badge>
					</view>
				</view>
			</movable-view>
		</movable-area>
	</view>
</template>

<style scoped lang="scss">
.movable-area {
	//可以移动的范围
	height: 100vh;
	width: 750rpx;
	top: 0;
	position: fixed;
	pointer-events: none; //此处要加，鼠标事件可以渗透
	z-index: 99997;
	overflow: visible;

	.movable-view {
		pointer-events: auto; //恢复鼠标事件
		overflow: visible;
	}
}

.mask {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: rgba(14, 14, 14, 0.65);
	backdrop-filter: blur(12px);
	opacity: 0;
	visibility: hidden;
	transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	z-index: 998;
}

.mask-show {
	opacity: 1;
	visibility: visible;
}

.floating-container {
	z-index: 999;
	overflow: visible;
}

.floating-button {
	border-radius: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	transform: rotate(0deg) translateZ(0) perspective(1000px);
	backdrop-filter: blur(12px);
	border: 1px solid rgba(0, 0, 0, 0.2);
	box-shadow: rgba(0, 0, 0, 0.24) 0px 2px 6px;
	overflow: visible;
}

.button-active {
	transform: rotate(135deg) translateZ(0) scale(1.05);
}

.menu-container {
	position: absolute;
	bottom: 56rpx;
	right: 56rpx;
	transform-origin: center center;
	display: flex;
	align-items: center;
	width: 0;
	height: 0;
	overflow: visible;
}

.menu-item {
	position: absolute;
	right: 0;
	bottom: 0;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	opacity: 0;
	transform: scale(0);
	transform-origin: bottom right;
	overflow: visible;
}

.menu-open .menu-item {
	opacity: 1;
}

.menu-item-inner {
	position: relative;
	margin-top: 2px;
	width: 96rpx;
	height: 96rpx;
	border-radius: 48rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	transform: perspective(1000px) rotateX(12deg) translateZ(10px);
	transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	backdrop-filter: blur(12px);
	border: 1px solid rgba(255, 255, 255, 0.2);
	overflow: visible;
}

.menu-item-inner:active {
	transform: perspective(1000px) rotateX(12deg) scale(0.95) translateZ(5px);
}

.menu-item-text {
	font-size: 10px;
	margin-top: 2px;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
	font-weight: 500;
	letter-spacing: 0.5px;
	transform: translateZ(5px);
	width: 100%;
	text-align: center;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	padding: 0 4px;
	box-sizing: border-box;
}
</style>
