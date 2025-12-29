# stars-Float-Popup-Menu悬浮组件

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/2679986ac4fe40e79347bd726312575c.png)

![请添加图片描述](https://i-blog.csdnimg.cn/direct/55104b2013e44fea8dd098dd7acdb8a8.gif)

# 使用

```vue
<template>
	<view>
		<FloatPopupMenu :menuItems="customMenuItems" buttonBgColor="linear-gradient(165deg, #FF6B6B 0%, #FFD166 100%)"
			activeButtonBgColor="linear-gradient(165deg, #FFD166 0%, #FF6B6B 100%)" iconColor="#333333"
			textColor="#333333" @menuClick="onMenuClick">
		</FloatPopupMenu>
	</view>
</template>

<script lang="ts" setup>
	import { ref } from 'vue';
	import FloatPopupMenu from "@/uni_modules/stars-Float-Popup-Menu/components/stars-Float-Popup-Menu/FloatPopupMenu.vue"

	const customMenuItems = [
		{ icon: 'home', text: '首页', menuBgColor: "linear-gradient(165deg, #2B5BDB 0%, #00C9FF 100%)", textColor: "#fff", iconColor: "#fff" },
		{ icon: 'staff', text: 'AI服务', menuBgColor: "linear-gradient(165deg, #2B5BDB 0%, #00C9FF 100%)", textColor: "#fff", iconColor: "#fff" },
		{ icon: 'person', text: '我的', menuBgColor: "linear-gradient(165deg, #FF6B6B 0%, #FFD166 100%)", textColor: "#333333", iconColor: "#333333" },
		{ icon: 'scan', text: 'NFC识别', menuBgColor: "linear-gradient(165deg, #2B5BDB 0%, #00C9FF 100%)", textColor: "#fff", iconColor: "#fff" }
	];

	const onMenuClick = (item) => {
		uni.showToast({
			title: `点击了${item.text}`,
			icon: 'none'
		});
		console.log('点击了菜单项:', item);
	};
</script>
```

悬浮按钮，扇形菜单。扇形菜单根据移动的角度自动变换。