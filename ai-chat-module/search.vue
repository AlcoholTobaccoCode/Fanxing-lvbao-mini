<!-- 
@description: 检索起始页
-->

<script lang="ts" setup>
import { computed, ref } from "vue";
import { searchPresets, type SearchType } from "../pages/home/config";

const emit = defineEmits<{
	(e: "preset-select", value: string): void;
}>();

const activeType = ref<SearchType>("law");

const questions = computed(() => searchPresets[activeType.value]);

const title = computed(() => (activeType.value === "law" ? "法条检索" : "案例检索"));

const desc = computed(() =>
	activeType.value === "law"
		? "欢迎使用法条检索智能助手！输入关键词或具体法律问题，我将为你精准定位相关法条，并提供最新修订说明与关联案例。"
		: "欢迎使用法律案例智能助手！输入案由、法条或关键词，我将为你精准检索相关案例，并提供裁判要旨分析。"
);

const handleClick = (q: string) => {
	emit("preset-select", q);
};

const switchType = (type: SearchType) => {
	activeType.value = type;
};
</script>

<template>
	<view class="flex flex-col gap-4">
		<view class="mt-2">
			<cl-text class="text-3xl font-bold text-surface-900 dark:text-white">
				{{ title }}
			</cl-text>
			<cl-text class="mt-3 text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
				{{ desc }}
			</cl-text>
		</view>

		<view class="mt-6">
			<view class="flex items-center justify-between mb-3">
				<cl-text class="text-xs text-surface-500 dark:text-surface-400">试着问我</cl-text>
				<cl-text class="text-xs text-primary">换一换</cl-text>
			</view>
			<view class="flex flex-col gap-3">
				<view
					v-for="item in questions"
					:key="item"
					class="p-3 rounded-2xl bg-primary/5 dark:bg-surface-700"
					@click="handleClick(item)"
				>
					<cl-text class="text-sm text-primary dark:text-primary-100">{{ item }}</cl-text>
				</view>
			</view>
		</view>

		<view class="mt-6 flex gap-2">
			<view
				class="flex-1 py-2 rounded-full border text-center text-xs"
				:class="[
					activeType === 'law'
						? 'border-primary bg-primary text-white'
						: 'border-surface-300 text-surface-600 dark:border-surface-600 dark:text-surface-200'
				]"
				@click="switchType('law')"
			>
				<cl-text>法条检索</cl-text>
			</view>
			<view
				class="flex-1 py-2 rounded-full border text-center text-xs"
				:class="[
					activeType === 'case'
						? 'border-primary bg-primary text-white'
						: 'border-surface-300 text-surface-600 dark:border-surface-600 dark:text-surface-200'
				]"
				@click="switchType('case')"
			>
				<cl-text>案例检索</cl-text>
			</view>
		</view>
	</view>
</template>
