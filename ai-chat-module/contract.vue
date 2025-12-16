<!-- 
@description: 合同起始页
-->
<script lang="ts" setup>
import { computed, ref } from "vue";
import { contractPresets, type ContractType } from "../pages/home/config";

const emit = defineEmits<{
	(e: "preset-select", value: string): void;
}>();

const activeType = ref<ContractType>("generate");

const questions = computed(() => contractPresets[activeType.value]);

const title = computed(() => (activeType.value === "generate" ? "合同生成" : "合同审核"));

const desc = computed(() =>
	activeType.value === "generate"
		? "请描述你需要的合同类型和具体内容，例如：我需要一份房屋租赁合同，租期一年，月租金3000元，押一付三。"
		: "上传或粘贴合同内容，我将协助识别风险条款并给出优化建议。"
);

const handleClick = (q: string) => {
	emit("preset-select", q);
};

const switchType = (type: ContractType) => {
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
				AI 专业合同撰写与风险识别。
			</cl-text>
			<cl-text class="mt-2 text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
				{{ desc }}
			</cl-text>
		</view>

		<view class="mt-6">
			<view class="flex items-center justify-between mb-3">
				<cl-text class="text-xs text-surface-500 dark:text-surface-400">可以这样问</cl-text>
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
					activeType === 'generate'
						? 'border-primary bg-primary text-white'
						: 'border-surface-300 text-surface-600 dark:border-surface-600 dark:text-surface-200'
				]"
				@click="switchType('generate')"
			>
				<cl-text>合同生成</cl-text>
			</view>
			<view
				class="flex-1 py-2 rounded-full border text-center text-xs"
				:class="[
					activeType === 'review'
						? 'border-primary bg-primary text-white'
						: 'border-surface-300 text-surface-600 dark:border-surface-600 dark:text-surface-200'
				]"
				@click="switchType('review')"
			>
				<cl-text>合同审核</cl-text>
			</view>
		</view>
	</view>
</template>
