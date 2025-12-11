// uni-app 事件总线封装
// 文档参考：https://en.uniapp.dcloud.io/uni-app-x/api/event-bus.html

// 事件映射类型：键是事件名，值是事件参数类型
export interface EventMap {
	[key: string]: any;
}

export interface EventBus<E extends EventMap = EventMap> {
	on<K extends keyof E & string>(event: K, handler: (payload: E[K]) => void): void;
	off<K extends keyof E & string>(event: K, handler?: (payload: E[K]) => void): void;
	once<K extends keyof E & string>(event: K, handler: (payload: E[K]) => void): void;
	emit<K extends keyof E & string>(event: K, payload: E[K]): void;
}

const hasUni = typeof uni !== "undefined" && !!uni;

export const createEventBus = <E extends EventMap = EventMap>(): EventBus<E> => {
	if (!hasUni) {
		// 非 uni 环境兜底：返回空实现，避免报错
		return {
			on: () => {},
			off: () => {},
			once: () => {},
			emit: () => {}
		};
	}

	return {
		on(event, handler) {
			uni.$on(event, handler as any);
		},
		off(event, handler?) {
			if (handler) {
				uni.$off(event, handler as any);
			} else {
				uni.$off(event);
			}
		},
		once(event, handler) {
			uni.$once(event, handler as any);
		},
		emit(event, payload) {
			uni.$emit(event, payload);
		}
	};
};

// 默认全局事件总线，可直接在项目中导入使用
export const eventBus: EventBus = createEventBus();
