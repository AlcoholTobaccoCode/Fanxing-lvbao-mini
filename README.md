# 🚀 Cool Unix

**基于 uni-app x 的跨端应用开发脚手架**

### 开发核心

- 核心框架
    - uni-app x
    - Vue 3 — 3.5.13
- 构建与工具
    - Vite — 6.3.5
    - Prettier — 3.5.3
- 样式与处理器
    - Tailwind CSS — 3.4.17
    - PostCSS — 8.5.3
    - Autoprefixer — 10.4.21
- 语言与类型
    - TypeScript
    - @vue/compiler-sfc — 3.5.16
    - @dcloudio/types — 3.4.16
    - @types/node — 24.0.15
- UI 与插件
    - Cool UI
    - @cool-vue/vite-plugin — 8.2.18
    - @cool-vue/ai — 1.1.7
- SDK 与第三方
    - Weixin JS SDK — 1.6.5
    - Hammer TouchEmulator — 0.0.2
- uni_modules 扩展
    - cool-open-web — 1.0.1
    - cool-share — 1.0.0
    - cool-svg — 1.0.0
    - cool-vibrate — 1.0.1
- 开发环境建议
    - HBuilderX ≥ 4.75（满足部分模块引擎要求）

### 项目概述

Cool Unix 是一个高效的项目脚手架。它内置了 UI 组件库、Service 请求、TailwindCSS 插件、多语言一键翻译等多种实用功能，极大提升了开发者的开发效率与体验。

- [📖 在线文档](https://unix.cool-js.com/)

- [🎯 快速开始](https://unix.cool-js.com/src/introduce/quick.html)

- [🌟 在线预览](https://unix.cool-js.com/demo)

### 组件库引入

如果你只需使用组件库，请参考 [🚀 组件库引入指南](https://unix.cool-js.com/src/introduce/uni-components.html) 进行配置，快速集成到你的项目中。

### 多语言

配置完成后，仅需执行一条命令，AI 即可自动检索并统一翻译全文内容，无需手动维护繁琐的中英对照表，大幅提升多语言开发效率。

```html
<text>{{ t('你好') }}</text>
```

在其他位置上绑定如下：

```html
<script setup lang="ts">
	import { $t, t } from "@/uni_modules/cool-ui";
	import { useUi } from "@/uni_modules/cool-ui";

	const ui = useUi();

	ui.showToast({
		message: t("操作成功")
	});

	ui.showToast({
		message: $t("欢迎回来，{name}", { name: "神仙都没用" })
	});
</script>
```

```shell
npx cool-i18n create
```

### TailwindCSS

不同于其他 UI 组件库仅内置简单样式，Cool Unix 深度兼容 TailwindCSS 的写法，支持如 `dark:`、`!` 等操作符，既保留了灵活性，也便于扩展。

```html
<view class="bg-surface-100 dark:!bg-surface-900">
	<text class="text-surface-700 dark:!text-white">Cool Unix</text>
</view>
```

### PassThrough

PassThrough 是一种用于访问组件内部 DOM 结构的 API，它允许开发者将任意属性和监听器直接应用于组件内部的 DOM 元素。这种设计的核心优势在于突破了组件主要 API 的限制，提供更灵活的定制能力。

```html
<cl-button
	:pt="{
    className: '!rounded-2xl',
    icon: {
      size: 50,
      className: 'mr-5',
    },
    label: {
      color: 'red',
      className: 'font-bold',
    },
    loading: {
      size: 50,
    },
  }"
>
	点击
</cl-button>
```

### 预览

<table>
  <tr>
    <td align="center">
      <img src="https://unix.cool-js.com/qrcode-h5.png" width="200px" /><br/>
      H5 预览
    </td>
    <td align="center">
      <img src="https://unix.cool-js.com/qrcode-apk.png" width="200px" /><br/>
      APP 下载
    </td>
  </tr>
</table>

### 开源协议

本项目基于 [MIT 协议](LICENSE) 开源，您可以自由使用、修改和分发。
