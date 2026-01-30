/**
 * 法条筛选 Store
 * 管理筛选条件和最近选择的地区
 */
import { ref } from "vue";
import { storage } from "@/cool/utils";
import { type LawFilters, createEmptyFilters } from "@/cool/types/law-filter";

// 最近选择地区最大数量
const MAX_RECENT_AREAS = 5;

const STORAGE_KEY_FILTERS = "law_filters";
const STORAGE_KEY_RECENT_AREAS = "law_recent_areas";

class LawFilterStore {
	// 当前筛选条件
	filters = ref<LawFilters>(createEmptyFilters());

	// 最近选择的地区 (最多5个)
	recentAreas = ref<string[]>([]);

	constructor() {
		this.loadFromStorage();
	}

	// 从本地存储加载
	private loadFromStorage() {
		const savedFilters = storage.get(STORAGE_KEY_FILTERS);
		if (savedFilters) {
			this.filters.value = {
				...createEmptyFilters(),
				...savedFilters
			};
		}

		const savedRecentAreas = storage.get(STORAGE_KEY_RECENT_AREAS);
		if (Array.isArray(savedRecentAreas)) {
			this.recentAreas.value = savedRecentAreas.slice(0, MAX_RECENT_AREAS);
		}
	}

	// 保存筛选条件到本地存储
	private saveFilters() {
		storage.set(STORAGE_KEY_FILTERS, this.filters.value, 0);
	}

	// 保存最近选择地区到本地存储
	private saveRecentAreas() {
		storage.set(STORAGE_KEY_RECENT_AREAS, this.recentAreas.value, 0);
	}

	// 更新筛选条件
	setFilters(newFilters: LawFilters) {
		this.filters.value = { ...newFilters };
		this.saveFilters();

		// 更新最近选择的地区
		if (newFilters.area_facet.length > 0) {
			this.addRecentAreas(newFilters.area_facet);
		}
	}

	// 添加最近选择的地区
	addRecentAreas(areas: string[]) {
		const current = [...this.recentAreas.value];
		// 将新选择的地区放到最前面，去重
		const updated = [...areas, ...current.filter((a) => !areas.includes(a))];
		this.recentAreas.value = updated.slice(0, MAX_RECENT_AREAS);
		this.saveRecentAreas();
	}

	// 清除单个筛选项
	removeFilter(type: keyof LawFilters, value?: string) {
		if (type === "lawstatexls_facet") {
			this.filters.value.lawstatexls_facet = null;
		} else if (value) {
			const arr = this.filters.value[type] as string[];
			this.filters.value[type] = arr.filter((v) => v !== value) as any;
		}
		this.saveFilters();
	}

	// 清除所有筛选条件
	clearFilters() {
		this.filters.value = createEmptyFilters();
		this.saveFilters();
	}

	// 检查是否有筛选条件
	get hasFilters(): boolean {
		const f = this.filters.value;
		return f.area_facet.length > 0 || f.xls.length > 0 || f.lawstatexls_facet !== null;
	}

	// 获取筛选条件数量
	get filterCount(): number {
		const f = this.filters.value;
		return f.area_facet.length + f.xls.length + (f.lawstatexls_facet ? 1 : 0);
	}
}

export const lawFilterStore = new LawFilterStore();
