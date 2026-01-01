import { ref } from "vue";

// 共享日志状态
const testLog = ref<string[]>([]);

export function useTestLog() {
	const addLog = (message: string) => {
		const time = new Date().toLocaleTimeString();
		testLog.value.unshift(`[${time}] ${message}`);
		if (testLog.value.length > 30) {
			testLog.value.pop();
		}
	};

	const clearLog = () => {
		testLog.value = [];
	};

	return {
		testLog,
		addLog,
		clearLog
	};
}
