/**
 * 展开状态管理 composable
 * 用于管理列表项的展开/收起状态
 */
import { ref } from "vue";

/**
 * 创建展开状态管理
 * @param defaultTab 默认选中的 tab
 */
export function useExpandState(defaultTab: string = "content") {
	// 模块整体展开状态
	const isExpanded = ref(false);

	// 列表项展开状态（存储展开的索引）
	const expandedIndexes = ref<number[]>([]);

	// 每个列表项当前选中的 tab
	const activeTabs = ref<Record<number, string>>({});

	// 内容展开状态（存储展开的索引）
	const expandedContentIndexes = ref<number[]>([]);

	// 切换模块整体展开状态
	const toggleExpand = () => {
		isExpanded.value = !isExpanded.value;
	};

	// 判断某个列表项是否展开
	const isItemExpanded = (index: number) => {
		return expandedIndexes.value.includes(index);
	};

	// 切换某个列表项的展开状态
	const toggleItemExpand = (index: number) => {
		const arr = expandedIndexes.value.slice();
		const i = arr.indexOf(index);
		if (i >= 0) {
			arr.splice(i, 1);
		} else {
			arr.push(index);
			// 默认选中 tab
			if (!activeTabs.value[index]) {
				activeTabs.value[index] = defaultTab;
			}
		}
		expandedIndexes.value = arr;
	};

	// 获取当前 tab
	const getActiveTab = (index: number) => {
		return activeTabs.value[index] || defaultTab;
	};

	// 设置当前 tab
	const setActiveTab = (index: number, tab: string) => {
		activeTabs.value[index] = tab;
	};

	// 判断内容是否展开
	const isContentExpanded = (index: number) => {
		return expandedContentIndexes.value.includes(index);
	};

	// 切换内容展开状态
	const toggleContentExpand = (index: number) => {
		const arr = expandedContentIndexes.value.slice();
		const i = arr.indexOf(index);
		if (i >= 0) {
			arr.splice(i, 1);
		} else {
			arr.push(index);
		}
		expandedContentIndexes.value = arr;
	};

	return {
		isExpanded,
		expandedIndexes,
		activeTabs,
		expandedContentIndexes,
		toggleExpand,
		isItemExpanded,
		toggleItemExpand,
		getActiveTab,
		setActiveTab,
		isContentExpanded,
		toggleContentExpand
	};
}
