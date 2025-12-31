import { reactive } from "vue";
import { isDev } from "@/config";

type Config = {
	fontSize: number | null;
	zIndex: number;
	startDate: string;
	endDate: string;
};

export const config = reactive<Config>({
	fontSize: isDev ? 1.1 : 1.3,
	zIndex: 600,
	startDate: "2000-01-01 00:00:00",
	endDate: "2050-12-31 23:59:59"
});
