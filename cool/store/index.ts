import { Dict, dict } from "./dict";
import { User, user } from "./user";
import { ImStore, imStore } from "./im";

type Store = {
	user: User;
	dict: Dict;
	im: ImStore;
};

export function useStore(): Store {
	return {
		user,
		dict,
		im: imStore
	};
}

export * from "./dict";
export * from "./user";
export * from "./im";
export * from "./chatInput-store";
