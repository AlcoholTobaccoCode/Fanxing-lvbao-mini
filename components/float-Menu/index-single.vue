<script lang="ts" setup>
import { ref } from "vue";

// 定义 props
const props = defineProps({
	disabled: {
		// 是否可以移动，false：可以移动，true：禁止移动
		type: Boolean,
		default: false
	},
	buttonBgColor: {
		// 按钮背景颜色
		type: String,
		default: "#fff"
	},
	iconName: {
		// 按钮图标名称
		type: String,
		default: "fxzh-caidan2"
	},
	iconSize: {
		// 按钮图标大小
		type: Number,
		default: 40
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
	showBadge: {
		// 是否显示角标
		type: Boolean,
		default: true
	}
});

// 定义 emits
const emits = defineEmits(["click"]);

const buttonX = ref(props.x);
const buttonY = ref(props.y);

// 初始化按钮位置
if (props.x === undefined || props.y === undefined) {
	uni.getSystemInfo().then((res) => {
		// 这里宽高减掉部分，是为了初始化的时候不贴右边，不贴底边
		buttonX.value = props.x ?? res.windowWidth - 80;
		buttonY.value = props.y ?? res.windowHeight - 80;
	});
}

// 按钮点击事件
const handleClick = () => {
	uni.vibrateShort();
	emits("click");
};
</script>
<template>
	<view>
		<movable-area class="movable-area">
			<movable-view
				class="movable-view"
				inertia
				:disabled="disabled"
				:x="buttonX"
				:y="buttonY"
				:style="{ width: floatingButtonWidth, height: floatingButtonHeight }"
				direction="all"
			>
				<!-- 悬浮按钮 -->
				<view
					class="floating-button"
					@click="handleClick"
					:style="{
						background: buttonBgColor,
						width: floatingButtonWidth,
						height: floatingButtonHeight
					}"
				>
					<cl-icon :name="iconName" :size="iconSize"></cl-icon>
				</view>
			</movable-view>
		</movable-area>
	</view>
</template>

<style scoped lang="scss">
.movable-area {
	// 可以移动的范围
	height: 100vh;
	width: 750rpx;
	top: 0;
	position: fixed;
	pointer-events: none; // 此处要加，鼠标事件可以渗透
	z-index: 99997;
	overflow: visible;

	.movable-view {
		pointer-events: auto; // 恢复鼠标事件
		overflow: visible;
	}
}

.floating-button {
	border-radius: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	backdrop-filter: blur(12px);
	border: 1px solid rgba(0, 0, 0, 0.2);
	box-shadow: rgba(0, 0, 0, 0.24) 0px 2px 6px;
	overflow: visible;
}

.floating-button:active {
	transform: scale(0.95);
}
</style>
