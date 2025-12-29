// 单一主色（如 #296D9D）生成 Tailwind 风格 50-950 色阶的工具

// --- 基础工具：hex <-> rgb <-> hsl ---

function clamp01(v) {
	if (v < 0) return 0;
	if (v > 1) return 1;
	return v;
}

function hexToRgb(hex) {
	var s = hex.replace("#", "");
	if (s.length === 3) {
		s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
	}
	var r = parseInt(s.slice(0, 2), 16);
	var g = parseInt(s.slice(2, 4), 16);
	var b = parseInt(s.slice(4, 6), 16);
	return { r: r, g: g, b: b };
}

function rgbToHex(r, g, b) {
	function toHex(x) {
		var h = x.toString(16);
		return h.length === 1 ? "0" + h : h;
	}
	return "#" + toHex(r) + toHex(g) + toHex(b);
}

function rgbToHsl(r, g, b) {
	r /= 255;
	g /= 255;
	b /= 255;
	var max = Math.max(r, g, b);
	var min = Math.min(r, g, b);
	var h = 0;
	var s = 0;
	var l = (max + min) / 2;
	if (max !== min) {
		var d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return { h: h, s: s, l: l };
}

function hslToRgb(h, s, l) {
	var r, g, b;
	if (s === 0) {
		r = g = b = l;
	} else {
		function hue2rgb(p, q, t) {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		}

		var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		var p = 2 * l - q;
		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}
	return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(b * 255)
	};
}

function hslToHex(h, s, l) {
	var rgb = hslToRgb(h, s, l);
	return rgbToHex(rgb.r, rgb.g, rgb.b);
}

// --- 核心：从单一主色生成 50-950 色阶 ---

var DEFAULT_LEVELS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// 针对 50-950 的亮度因子（相对 500 档位），可以根据审美微调
// 数组下标与 DEFAULT_LEVELS 一一对应
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

// baseHex: 主色，如 "#296D9D"
// levels:  色阶列表，如 [50,100,...,950]
// factors: 相对亮度因子数组，与 levels 一一对应
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

// 针对律先峰当前主色的快捷方法
function createFanxingzhihuiScale() {
	return createScaleFromBase("#296D9D");
}

// 调试输出：运行此文件即可在控制台看到 fanxingzhihui 的完整色阶
var fanxingzhihuiScale = createFanxingzhihuiScale();
console.log("fanxingzhihui scale (from base #296D9D):", fanxingzhihuiScale);

// 如需在其他地方复用，可以按需暴露到 globalThis（浏览器环境）
if (typeof globalThis !== "undefined") {
	globalThis.createScaleFromBase = createScaleFromBase;
	globalThis.createFanxingzhihuiScale = createFanxingzhihuiScale;
}
