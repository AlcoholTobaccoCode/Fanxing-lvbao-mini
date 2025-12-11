## 1. 使用示例

### 1.1 直接用默认全局总线

```ts
// A 页面
import { eventBus } from "@/utils/eventBus";

eventBus.on("im:newMessage", (payload) => {
	console.log("新消息", payload);
});

// B 页面
eventBus.emit("im:newMessage", { from: "71", text: "hello" });
```

### 1.2 带类型的自定义总线（可选）

```ts
import { createEventBus, type EventMap } from "@/utils/eventBus";

interface MyEvents extends EventMap {
	"im:newMessage": { from: string; text: string };
	"im:unreadChange": number;
}

export const imBus = createEventBus<MyEvents>();

imBus.on("im:newMessage", (msg) => {
	// msg 自动推断为 { from: string; text: string }
});

imBus.emit("im:unreadChange", 12);
```
