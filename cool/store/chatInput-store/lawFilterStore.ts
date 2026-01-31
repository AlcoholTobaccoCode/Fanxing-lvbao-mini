/**
 * 法条筛选 Store
 * 管理筛选条件和最近选择的地区
 */
import { ref, computed } from "vue";
import { storage } from "@/cool/utils";
import { type LawFilters, createEmptyFilters } from "@/cool/types/law-filter";
import { GetLawStarXlsDict } from "@/api/dict";

// 效力级别选项类型
export interface XlsOption {
	code: string; // "001"
	label: string; // "法律"
}

// 静态 fallback 数据（未登录或接口请求失败时使用）
const XLS_FALLBACK_DATA: Record<string, string> = {
	"001": "法律",
	"002": "司法解释",
	"003": "行政法规",
	"004": "监察法规",
	"005": "部门规章",
	"006": "军事法规规章",
	"007": "党内法规制度",
	"008": "团体规定",
	"009": "行业规定",
	"010": "部门立法资料",
	"011": "地方性法规",
	"012": "地方政府规章",
	"013": "行政许可批复",
	"014": "地方司法文件",
	"015": "地方规范性文件"
};

// 最近选择地区最大数量
const MAX_RECENT_AREAS = 5;

const STORAGE_KEY_FILTERS = "law_filters";
const STORAGE_KEY_RECENT_AREAS = "law_recent_areas";

class LawFilterStore {
	// 当前筛选条件
	filters = ref<LawFilters>(createEmptyFilters());

	// 最近选择的地区 (最多5个)
	recentAreas = ref<string[]>([]);

	// 效力级别选项（从字典加载）
	xlsOptions = ref<XlsOption[]>([]);

	// 效力级别加载状态
	xlsLoading = ref(false);

	// 效力级别 code -> label 映射
	xlsLabelMap = computed(() => {
		const map: Record<string, string> = {};
		for (const opt of this.xlsOptions.value) {
			map[opt.code] = opt.label;
		}
		return map;
	});

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

	// 加载效力级别选项
	async loadXlsOptions() {
		// 已加载或正在加载则跳过
		if (this.xlsOptions.value.length > 0 || this.xlsLoading.value) {
			return;
		}

		this.xlsLoading.value = true;
		try {
			const res = await GetLawStarXlsDict();
			if (res?.value) {
				this.setXlsOptionsFromData(res.value);
			} else {
				// 接口返回空数据，使用 fallback
				this.setXlsOptionsFromData(XLS_FALLBACK_DATA);
			}
		} catch (e) {
			console.error("加载效力级别选项失败，使用静态数据:", e);
			this.setXlsOptionsFromData(XLS_FALLBACK_DATA);
		} finally {
			this.xlsLoading.value = false;
		}
	}

	// 从数据对象设置效力级别选项
	private setXlsOptionsFromData(data: Record<string, string>) {
		const options: XlsOption[] = [];
		for (const code in data) {
			options.push({
				code,
				label: data[code]
			});
		}
		// 按 code 排序
		options.sort((a, b) => a.code.localeCompare(b.code));
		this.xlsOptions.value = options;
	}

	// 根据 code 获取 label
	getXlsLabel(code: string): string {
		return this.xlsLabelMap.value[code] || code;
	}
}

export const lawFilterStore = new LawFilterStore();
