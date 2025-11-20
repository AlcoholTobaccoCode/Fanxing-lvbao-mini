<!-- 
@description: 咨询起始页
-->
<script lang="ts" setup>
import SimpleCard from "@/components/common/card/simple-card.uvue";

const emit = defineEmits<{
	(e: "preset-select", value: string): void;
}>();

const questions = [
	"如何注册商标并保障我的商标权益？",
	"离婚时共同财产一般如何分割？",
	"遭遇网络诈骗后，我应该立刻怎么做？"
];

const handleClick = (q: string) => {
	emit("preset-select", q);
};
</script>

<template>
	<view class="flex flex-col gap-4">
		<view class="mt-2">
			<cl-text class="text-3xl font-bold text-surface-900 dark:text-white leading-snug">
				Hi，
				<br />
				欢迎使用 <text class="text-primary">律先锋</text>
			</cl-text>
			<cl-text class="mt-3 text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
				基于百万级真实判例与全量法律法规训练，为你提供精准、深度、有据可依的法律智能分析。
			</cl-text>
		</view>

		<view class="mt-6">
			<view class="flex items-center justify-between mb-3">
				<cl-text class="text-xs text-surface-500 dark:text-surface-400">试着问我</cl-text>
				<cl-text class="text-xs text-primary">换一换</cl-text>
			</view>
			<view class="flex flex-col gap-3">
				<simple-card
					v-for="item in questions"
					:key="item"
					class="rounded-2xl bg-primary/5 dark:bg-surface-700"
					@click="handleClick(item)"
				>
					<cl-text class="text-sm text-primary dark:text-primary-100">{{ item }}</cl-text>
				</simple-card>
			</view>
		</view>
	</view>
</template>
