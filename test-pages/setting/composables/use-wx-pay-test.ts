import { ref, reactive } from "vue";
import { useUi } from "@/uni_modules/cool-ui";
import { useTestLog } from "./use-test-log";

export function useWxPayTest() {
	const ui = useUi();
	const { addLog } = useTestLog();

	const wxLoginCode = ref("");
	const wxLoginLoading = ref(false);

	// 支付参数
	const payParams = reactive({
		timeStamp: "",
		nonceStr: "",
		package: "",
		signType: "RSA",
		paySign: ""
	});

	// JSON 解析输入
	const jsonInput = ref("");

	// 获取微信登录 code
	const getWxLoginCode = () => {
		wxLoginLoading.value = true;
		uni.login({
			provider: "weixin",
			success: (res) => {
				wxLoginCode.value = res.code ?? "";
				addLog(`✅ 获取 code 成功: ${wxLoginCode.value}`);
			},
			fail: (err) => {
				addLog(`❌ 获取 code 失败: ${JSON.stringify(err)}`);
				ui.showToast({ message: "获取 code 失败" });
			},
			complete: () => {
				wxLoginLoading.value = false;
			}
		});
	};

	// 复制 code
	const copyCode = () => {
		if (!wxLoginCode.value) {
			return;
		}
		uni.setClipboardData({
			data: wxLoginCode.value,
			success: () => {}
		});
	};

	// 解析 JSON 填充参数
	const parseJsonParams = () => {
		if (!jsonInput.value.trim()) {
			return;
		}
		try {
			const parsed = JSON.parse(jsonInput.value.trim());
			if (parsed.timeStamp) payParams.timeStamp = String(parsed.timeStamp);
			if (parsed.nonceStr) payParams.nonceStr = parsed.nonceStr;
			if (parsed.package) payParams.package = parsed.package;
			if (parsed.signType) payParams.signType = parsed.signType;
			if (parsed.paySign) payParams.paySign = parsed.paySign;
			addLog("✅ JSON 解析成功");
			ui.showToast({ message: "解析成功" });
		} catch (err) {
			addLog(`❌ JSON 解析失败: ${err}`);
			ui.showToast({ message: "JSON 格式错误" });
		}
	};

	// 发起支付请求（手动填写参数测试）
	const requestPayment = () => {
		if (!payParams.timeStamp || !payParams.nonceStr || !payParams.package || !payParams.paySign) {
			ui.showToast({ message: "请填写完整支付参数" });
			return;
		}

		const orderInfo = {
			timeStamp: String(payParams.timeStamp),
			nonceStr: String(payParams.nonceStr),
			package: String(payParams.package),
			signType: String(payParams.signType),
			paySign: String(payParams.paySign)
		};

		addLog("开始发起微信支付...");
		addLog(`orderInfo: ${JSON.stringify(orderInfo)}`);

		//@ts-ignore
		uni.requestPayment({
			provider: "wxpay",
			...orderInfo,
			success: (res) => {
				addLog(`✅ 支付成功: ${JSON.stringify(res)}`);
				ui.showToast({ message: "支付成功" });
			},
			fail: (res) => {
				addLog(`❌ 支付失败: ${JSON.stringify(res)}`);
				ui.showToast({ message: `支付失败: ${JSON.stringify(res)}` });
			},
			complete: (res) => {
				addLog(`支付完成: ${JSON.stringify(res)}`);
			}
		});
	};

	return {
		wxLoginCode,
		wxLoginLoading,
		payParams,
		jsonInput,
		getWxLoginCode,
		copyCode,
		parseJsonParams,
		requestPayment
	};
}
