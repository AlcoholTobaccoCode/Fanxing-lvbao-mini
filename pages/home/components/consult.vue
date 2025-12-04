<!-- 
@description: 咨询起始页
-->
<script lang="ts" setup>
import { LEGAL_QUICK_QUESTIONS, chunkArray, type chunkArrayType } from "@/utils/index";

import SimpleCard from "@/components/card/simple-card.uvue";
import { ref } from "vue";

const emit = defineEmits<{
	(e: "preset-select", value: string): void;
}>();

const questionPools = ref<chunkArrayType>([]);
const currentPoolIndex = ref(0);
const presetQuestions = ref<string[]>([]);

onLoad(() => {
	questionPools.value = chunkArray(LEGAL_QUICK_QUESTIONS, 3);
	presetQuestions.value = questionPools.value[0] || [];
});

const handleClick = (q: string) => {
	emit("preset-select", q);
};

const handleRefresh = () => {
	if (!questionPools.value.length) return;
	const nextIndex = (currentPoolIndex.value + 1) % questionPools.value.length;
	currentPoolIndex.value = nextIndex;
	presetQuestions.value = questionPools.value[nextIndex];
};
</script>

<template>
	<view class="flex flex-col gap-4">
		<view class="mt-2">
			<cl-text size="28px" :pt="{ className: 'font-bold' }">
				Hi，
				<br />
				欢迎使用
				<cl-text size="28px" :pt="{ className: 'text-primary-500' }">律先锋</cl-text>
			</cl-text>
			<cl-text :pt="{ className: 'text-sm text-surface-400 my-2' }">
				基于百万级真实判例与全量法律法规训练，为你提供精准、深度、有据可依的法律智能分析。
			</cl-text>
		</view>

		<view class="mt-6">
			<view class="flex flex-row items-center justify-between mb-3">
				<cl-text :pt="{ className: 'text-sm text-surface-500 my-2' }"> 试着问我</cl-text>
				<view class="flex flex-row items-center gap-1" @click="handleRefresh">
					<cl-text :pt="{ className: 'text-sm text-surface-500' }">换一换</cl-text>
					<cl-icon name="refresh-line" size="14px" color="info"></cl-icon>
				</view>
			</view>
			<view class="flex flex-col gap-2">
				<view v-for="(item, i) in presetQuestions" :key="i" @click="handleClick(item)">
					<cl-button
						border
						:pt="{
							className: '',
							label: { className: 'w-full text-left' }
						}"
					>
						{{ item }}
					</cl-button>
				</view>
			</view>
		</view>
	</view>
</template>
