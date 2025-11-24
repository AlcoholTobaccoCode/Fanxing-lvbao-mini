<!-- 
@description: 咨询起始页
-->
<script lang="ts" setup>
import SimpleCard from "@/components/common/card/simple-card.uvue";
import { consultPresets } from "../config";

const emit = defineEmits<{
	(e: "preset-select", value: string): void;
}>();

const handleClick = (q: string) => {
	emit("preset-select", q);
};

const handleRefresh = () => {
	// TODO: 实现换一换功能
	console.log("换一换");
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
				<view v-for="item in consultPresets" :key="item" @click="handleClick(item)">
					<cl-button
						text
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
