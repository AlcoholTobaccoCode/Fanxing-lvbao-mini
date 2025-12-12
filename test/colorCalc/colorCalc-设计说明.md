# colorCalc 色阶生成设计说明

## 一、目标与使用场景

**目标**：

- 只有一个品牌主色（例如 `#296D9D`）的情况下，自动生成一整套 Tailwind 风格的颜色色阶（`50, 100, ..., 950`）。
- 生成的色阶围绕主色展开：
    - `500` 档位是**原始主色**。
    - 50–400 是更浅的色（接近白）。
    - 600–950 是更深的色（接近黑）。

**典型使用场景**：

- 给设计只提供了一个主色的项目（当前的律先锋 `#296D9D`），快速构造完整主题色板，用于 Tailwind / cool 主题配置。

对应代码文件：`test/other.bac/colorCalc.js`

---

## 二、总体思路：基于 HSL 调整亮度

RGB 不太适合“视觉上均匀”的明暗调整，所以这里采用更适合人眼感知的 **HSL 色彩模型**：

- **H（Hue）色相**：控制颜色的“类型”（蓝色、红色、绿色等）
- **S（Saturation）饱和度**：控制颜色的“鲜艳程度”
- **L（Lightness）亮度**：控制颜色的“明暗程度”

思路非常简单：

1. 将主色 `#296D9D` 从 HEX → RGB → HSL。
2. **固定 H 和 S**（保持“这是同一种颜色”），只通过调整 L（亮度）来生成不同明暗层级。
3. 为每个层级（50, 100, ..., 950）指定一个“亮度因子”，乘在主色的亮度 L 上：
    - 比 1 大 → 比主色更亮（偏 50–400）。
    - 等于 1 → 还原主色（500）。
    - 比 1 小 → 比主色更暗（偏 600–950）。
4. 再把调整后的 HSL 转回 RGB → HEX，就得到每个档位的颜色。

优点：

- 整套色板色相统一，饱和度几乎不变，只是明暗变化 → 看起来比较“整齐”。
- 只需要一个主色，就能推得一整套包含“浅/正常/深”的颜色。

---

## 三、关键工具函数说明

### 1. clamp01

```js
function clamp01(v) {
	if (v < 0) return 0;
	if (v > 1) return 1;
	return v;
}
```

- 限制数值在 `[0, 1]` 范围内。
- HSL 中的 `s`、`l` 都是 0–1 范围，因此在做乘法调整后用它兜底防止溢出。

### 2. HEX ↔ RGB

```js
function hexToRgb(hex) { ... }
function rgbToHex(r, g, b) { ... }
```

- `hexToRgb("#296D9D") → { r, g, b }`。
- `rgbToHex(r, g, b) → "#296d9d"`。
- 支持 3 位和 6 位 HEX（例如 `#fff`、`#ffffff`）。

### 3. RGB ↔ HSL

```js
function rgbToHsl(r, g, b) { ... }
function hslToRgb(h, s, l) { ... }
function hslToHex(h, s, l) { ... }
```

- `rgbToHsl`：标准算法实现，输出 `{ h, s, l }`，其中：
    - `h ∈ [0,1]`，代表 0–360° 的归一化角度。
    - `s ∈ [0,1]`，饱和度。
    - `l ∈ [0,1]`，亮度。
- `hslToRgb`：HSL 反推回 RGB。
- `hslToHex`：HSL 直接转 HEX，内部是 `hslToRgb → rgbToHex`。

你可以把这一段看作“颜色空间转换工具层”，不需要每次都重新写。

---

## 四、核心算法：createScaleFromBase

核心函数定义：

```js
var DEFAULT_LEVELS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

var DEFAULT_LIGHTNESS_FACTORS = [
	1.35, // 50  最亮
	1.2, // 100
	1.1, // 200
	1.05, // 300
	1.02, // 400
	1.0, // 500 基准色
	0.92, // 600
	0.82, // 700
	0.7, // 800
	0.58, // 900
	0.48 // 950 最暗
];

function createScaleFromBase(baseHex, levels, factors) {
	levels = levels || DEFAULT_LEVELS;
	factors = factors || DEFAULT_LIGHTNESS_FACTORS;

	var rgb = hexToRgb(baseHex);
	var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
	var baseL = hsl.l;

	var palette = {};
	for (var i = 0; i < levels.length; i++) {
		var factor = factors[i] != null ? factors[i] : 1.0;
		var l = clamp01(baseL * factor);
		var hex = hslToHex(hsl.h, hsl.s, l);
		palette[levels[i]] = hex;
	}

	// 确保 500 档位就是原始主色
	for (var j = 0; j < levels.length; j++) {
		if (levels[j] === 500) {
			palette[500] = baseHex.toLowerCase();
			break;
		}
	}

	return palette;
}
```

### 1. levels / factors 的含义

- `levels`：表示要生成哪些档位，默认是 Tailwind 常用的：`[50,100,200,300,400,500,600,700,800,900,950]`。
- `factors`：每个档位相对于主色亮度 `L` 的倍率：
    - `factor > 1` → 变亮。
    - `factor = 1` → 不变（即主色本身）。
    - `factor < 1` → 变暗。

示例：假设主色的亮度 `L = 0.45`：

- 50 档：`L50 = clamp01(0.45 * 1.35) ≈ 0.61` → 明显更亮。
- 500 档：`L500 = 0.45 * 1.0 = 0.45` → 原始主色。
- 900 档：`L900 = 0.45 * 0.58 ≈ 0.26` → 明显更暗。

### 2. 强制保证 500 档位等于原始主色

即使按因子计算出来的值可能很接近原色，为了完全一致，代码会在循环后再强制把 `palette[500]` 设成 `baseHex`：

```js
if (levels[j] === 500) {
	palette[500] = baseHex.toLowerCase();
}
```

这样可以保证：

- 设计给出的主色 **只用在一个地方存储**。
- `500` 永远是设计原稿，方便比对和调整。

---

## 五、针对律先锋的封装：createFanxingzhihuiScale

因为当前律先锋项目的主色是 `#296D9D`，所以单独提供了一个快捷方法：

```js
function createFanxingzhihuiScale() {
	return createScaleFromBase("#296D9D");
}

var fanxingzhihuiScale = createFanxingzhihuiScale();
console.log("fanxingzhihui scale (from base #296D9D):", fanxingzhihuiScale);
```

用法非常简单：

1. 在浏览器控制台或 Node 里执行 `colorCalc.js`。
2. 控制台会输出类似：

```js
{
  50:  "#xxxxxx",
  100: "#xxxxxx",
  ...
  500: "#296d9d",
  ...
  950: "#xxxxxx"
}
```

3. 你可以把结果拷贝到 `tailwind.config.ts` 中对应的 `palette` 配置里。

同时为了方便在临时调试中复用，文件末尾还有：

```js
if (typeof globalThis !== "undefined") {
	globalThis.createScaleFromBase = createScaleFromBase;
	globalThis.createFanxingzhihuiScale = createFanxingzhihuiScale;
}
```

这意味着：

- 在浏览器控制台中你可以直接调用：

```js
createScaleFromBase("#ff0000");
createFanxingzhihuiScale();
```

- 方便你对比不同基色生成出来的完整色阶效果。

---

## 六、如何调整成你自己喜欢的效果

你可以通过 **只改一个地方** 来“调味”：`DEFAULT_LIGHTNESS_FACTORS`。

```js
var DEFAULT_LIGHTNESS_FACTORS = [
	1.35, // 50  最亮
	1.2, // 100
	1.1, // 200
	1.05, // 300
	1.02, // 400
	1.0, // 500 基准色
	0.92, // 600
	0.82, // 700
	0.7, // 800
	0.58, // 900
	0.48 // 950 最暗
];
```

- 想要整体更“淡雅”：
    - 把前面几个变小一点（比如 `1.25, 1.15, 1.05, ...`）。
- 想要深色更“黑”：
    - 把后面几个变小一点（比如 `0.7 → 0.6`, `0.58 → 0.45`）。
- 想要整个系列更“高对比度”：
    - 拉大两端倍数，比如：`1.4` 和 `0.4`。

调整流程建议：

1. 改一组因子。
2. 运行 `colorCalc.js` 看控制台输出的 HEX。
3. 把结果临时塞进 Tailwind 或直接在页面上找几个元素用 `bg-primary-50/500/900` 感受视觉效果。

---

## 七、与之前 gradient 插值方案的对比

之前的版本是：

- 需要给定 `startColor` 和 `endColor`，然后用 RGB 线性插值生成中间色。
- 对现在的需求（只有一个主色）并不友好，而且 RGB 线性插值视觉效果不如 HSL 自然。

现在 HSL 方案的特点：

- **不需要 endColor**：单一主色即可。
- 色相和饱和度一致，变化逻辑清晰：全部通过亮度控制。
- 因子数组比较直观，调一调就能看到明显区别，方便你做“主观优化”。

---

## 八、你可以怎么用这套代码做实验

1. **换主色实验**

```js
var greenScale = createScaleFromBase("#16a34a"); // Tailwind green 风格
console.log(greenScale);
```

2. **改 factors 实验**

在 `colorCalc.js` 中：

```js
var DEFAULT_LIGHTNESS_FACTORS = [1.4, 1.25, 1.1, 1.05, 1.02, 1.0, 0.9, 0.78, 0.65, 0.52, 0.4];
```

保存后重新运行脚本，观察输出的 HEX 有什么变化，并在项目页面中实际看效果。

3. **对齐 Tailwind 官方色板**

你也可以对比 Tailwind 官方某个颜色（比如 `cyan`）的 50–950 实际 HEX 值，然后手动微调 `DEFAULT_LIGHTNESS_FACTORS`，让生成的色板“视觉对齐”到你喜欢的风格。

---

如果后续你想把这套逻辑抽成一个真正的 NPM 包或 uni-app 内的通用工具，也可以在这个基础上：

- 增加 `S` 的调整（比如浅色略微降低饱和度，深色略微提高饱和度）。
- 支持通过配置文件批量生成多个主题色系列。

当前这个版本已经能比较优雅地解决“只给一个主色，怎么自动算出整套色阶”的问题，适合作为你的项目内部设计系统的起步版本。
