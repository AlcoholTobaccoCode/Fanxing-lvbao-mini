<template>
	<view class="law-markdown-view">
		<mp-html
			:selectable="selectable"
			:scroll-table="scrollTable"
			:tag-style="tagStyle"
			:markdown="true"
			:content="processedContent"
			@linktap="handleLinkTap"
		/>
	</view>
</template>

<script>
import mpHtml from "../mp-html/mp-html";
import { preprocessLawMarkdown, parseLawLinkTap } from "../../utils/lawMarkdownParser";
import { config } from "@/uni_modules/cool-ui/config";

export default {
	name: "law-markdown-view",
	components: { mpHtml },
	props: {
		markdown: {
			type: String,
			default: ""
		},
		selectable: {
			type: [Boolean, String],
			default: true
		},
		scrollTable: {
			type: Boolean,
			default: true
		},
		themeColor: {
			type: String,
			default: "#007AFF"
		},
		codeBgColor: {
			type: String,
			default: "#2d2d2d"
		}
	},
	emits: ["ref-tap", "link-tap"],
	data() {
		return {
			content: ""
		};
	},
	computed: {
		// 获取字体缩放比例
		fontScale() {
			return config.fontSize ?? 1;
		},
		processedContent() {
			if (!this.content) return "";
			// 传入 scale 用于内联样式
			let result = preprocessLawMarkdown(this.content, this.fontScale);
			// 处理流式代码块
			const codeBlocks = result.match(/```[\s\S]*?```|```[\s\S]*?$/g) || [];
			const lastBlock = codeBlocks[codeBlocks.length - 1];
			if (lastBlock && !lastBlock.endsWith("```")) {
				result += "\n";
			}
			return result;
		},
		tagStyle() {
			const c = this.themeColor;
			const bg = this.codeBgColor;
			const scale = this.fontScale;
			// 根据 scale 计算字体大小
			const fs = (base) => `font-size: ${Math.round(base * scale)}px;`;
			return {
				p: fs(16),
				h1: `margin:18px 0 10px 0; ${fs(24)} color: ${c};`,
				h2: `margin:14px 0 10px 0; ${fs(20)} color: ${c};`,
				h3: `margin:12px 0 8px 0; ${fs(18)} color: ${c};`,
				h4: `margin:12px 0 8px 0; ${fs(16)} color: ${c};`,
				blockquote: `margin:15px 0; ${fs(15)} color: #777; border-left: 4px solid #ddd; padding: 0 10px;`,
				ul: `margin: 10px 0; ${fs(16)} color: #555;`,
				li: `margin: 5px 0; ${fs(16)} color: #555;`,
				strong: `font-weight: bold; color: ${c};`,
				pre: `border-radius: 5px; background: ${bg}; ${fs(12)}`
			};
		}
	},
	watch: {
		markdown: {
			handler(val) {
				this.content = val;
			},
			immediate: true
		}
	},
	methods: {
		handleLinkTap(attrs) {
			const lawRef = parseLawLinkTap(attrs);
			if (lawRef) {
				// 法律引用点击：emit ref-tap 事件
				this.$emit("ref-tap", lawRef);
			} else {
				// 普通链接
				this.$emit("link-tap", attrs);
			}
		}
	}
};
</script>

<style lang="scss">
.law-markdown-view {
	padding: 15rpx;
}

/* 案例引用 - 下划线链接 */
.law-case-ref {
	color: #007aff;
	text-decoration: underline;
	text-decoration-style: dashed;
}
</style>
