<!-- 
@description: 文书起始页
-->
<script lang="ts" setup>
import { computed, ref } from "vue";

const emit = defineEmits<{
	(e: "preset-select", value: string): void;
}>();

type DocumentType = "indictment" | "defense";

const activeType = ref<DocumentType>("indictment");

const indictmentQuestions = [
	"帮我生成一份民事起诉状草稿。",
	"根据这个案情，起草一份起诉状。",
	"优化一下我现有的起诉状，让结构更清晰。"
];

const defenseQuestions = [
	"根据这个案情，帮我起草一份刑事答辩状。",
	"请根据以下案情撰写一份民事答辩状。",
	"优化一下我现有的答辩状，让逻辑更严谨。"
];

const questions = computed(() =>
	activeType.value === "indictment" ? indictmentQuestions : defenseQuestions
);

const title = computed(() => (activeType.value === "indictment" ? "起诉状" : "答辩状"));

const handleClick = (q: string) => {
	emit("preset-select", q);
};

const switchType = (type: DocumentType) => {
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
				根据案情描述，自动总结法律诉求并一键生成专属法律文书。
			</cl-text>
			<cl-text class="mt-2 text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
				请尽可能详细地描述案情的事实和法律诉求，包括当事人信息、时间地点、起因经过和结果等，详细的描述有助于{{
					title
				}}的准确书写。
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
					activeType === 'indictment'
						? 'border-primary bg-primary text-white'
						: 'border-surface-300 text-surface-600 dark:border-surface-600 dark:text-surface-200'
				]"
				@click="switchType('indictment')"
			>
				<cl-text>起诉状</cl-text>
			</view>
			<view
				class="flex-1 py-2 rounded-full border text-center text-xs"
				:class="[
					activeType === 'defense'
						? 'border-primary bg-primary text-white'
						: 'border-surface-300 text-surface-600 dark:border-surface-600 dark:text-surface-200'
				]"
				@click="switchType('defense')"
			>
				<cl-text>答辩状</cl-text>
			</view>
		</view>
	</view>
</template>
