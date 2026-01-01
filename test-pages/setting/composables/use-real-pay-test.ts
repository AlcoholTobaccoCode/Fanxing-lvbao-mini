import { ref, reactive } from "vue";
import { useUi } from "@/uni_modules/cool-ui";
import { useTestLog } from "./use-test-log";
import {
	WxLogin,
	CreateJsApiOrder,
	GetOrderStatus,
	CloseOrder,
	GetOrderList,
	RegeneratePayment,
	type OrderInfo
} from "@/api/payment/wx";

export function useRealPayTest() {
	const ui = useUi();
	const { addLog } = useTestLog();

	const realPayState = reactive({
		openid: "",
		sessionKey: "",
		outTradeNo: "",
		loading: false,
		step: 1 // 1: 创建订单, 2: 发起支付
	});

	// 支付参数（与手动测试共用结构）
	const payParams = reactive({
		timeStamp: "",
		nonceStr: "",
		package: "",
		signType: "RSA",
		paySign: ""
	});

	// 套餐选项
	const packageOptions = [{ id: 1, name: "测试商品", price: "0.01" }];
	const selectedPackageId = ref(1);

	// 订单列表
	const orderList = ref<OrderInfo[]>([]);
	const orderListLoading = ref(false);
	const showOrderList = ref(false);

	// 静默获取 openid（返回 Promise）
	const ensureOpenId = (): Promise<string> => {
		return new Promise((resolve, reject) => {
			if (realPayState.openid) {
				resolve(realPayState.openid);
				return;
			}

			uni.login({
				provider: "weixin",
				success: async (loginRes) => {
					const code = loginRes.code ?? "";
					try {
						const res = await WxLogin({ code });
						realPayState.openid = res.openid;
						realPayState.sessionKey = res.session_key;
						resolve(res.openid);
					} catch (err: any) {
						addLog(`❌ 获取 openid 失败: ${err?.message || JSON.stringify(err)}`);
						reject(err);
					}
				},
				fail: (err) => {
					addLog(`❌ 获取 code 失败: ${JSON.stringify(err)}`);
					reject(err);
				}
			});
		});
	};

	// 创建订单
	const createRealOrder = async () => {
		realPayState.loading = true;
		addLog("📝 创建订单中...");

		try {
			const openid = await ensureOpenId();

			const res = await CreateJsApiOrder({
				openid,
				package_id: selectedPackageId.value
			});

			realPayState.outTradeNo = res.order.outTradeNo;

			const rp = res.requestPayment || {};
			payParams.timeStamp = rp.timeStamp;
			payParams.nonceStr = rp.nonceStr;
			payParams.package = rp.package;
			payParams.signType = rp.signType;
			payParams.paySign = rp.paySign;

			realPayState.step = 2;
			addLog(`✅ 订单创建成功: ${res.order.outTradeNo}`);
			ui.showToast({ message: "订单创建成功" });
		} catch (err: any) {
			addLog(`❌ 创建订单失败: ${err?.message || JSON.stringify(err)}`);
			ui.showToast({ message: "创建订单失败" });
		} finally {
			realPayState.loading = false;
		}
	};

	// 发起支付
	const doRealPayment = () => {
		if (!payParams.timeStamp || !payParams.package) {
			ui.showToast({ message: "请先创建订单" });
			return;
		}

		const orderInfo = {
			timeStamp: String(payParams.timeStamp),
			nonceStr: String(payParams.nonceStr),
			package: String(payParams.package),
			signType: String(payParams.signType),
			paySign: String(payParams.paySign)
		};

		addLog("💰 发起微信支付...");

		//@ts-ignore
		uni.requestPayment({
			provider: "wxpay",
			...orderInfo,
			success: async (res) => {
				addLog(`✅ 支付成功: ${JSON.stringify(res)}`);
				ui.showToast({ message: "支付成功" });
				await checkOrderStatus();
			},
			fail: (res) => {
				addLog(`❌ 支付失败/取消: ${JSON.stringify(res)}`);
				ui.showToast({ message: `支付失败: ${res.errMsg || "用户取消"}` });
			}
		});
	};

	// 查询订单状态
	const checkOrderStatus = async () => {
		if (!realPayState.outTradeNo) {
			ui.showToast({ message: "没有可查询的订单" });
			return;
		}

		addLog(`🔍 查询订单状态: ${realPayState.outTradeNo}`);

		try {
			const res = await GetOrderStatus(realPayState.outTradeNo);
			addLog(`📋 订单状态: ${JSON.stringify(res)}`);
			ui.showToast({ message: `订单状态: ${res.status}` });
		} catch (err: any) {
			addLog(`❌ 查询失败: ${err?.message || JSON.stringify(err)}`);
		}
	};

	// 关闭订单
	const closeCurrentOrder = async (order: OrderInfo) => {
		addLog(`🔒 关闭订单: ${order.outTradeNo}`);

		try {
			await CloseOrder(order.outTradeNo);
			addLog(`✅ 订单已关闭`);
			ui.showToast({ message: "订单已关闭" });
			fetchOrderList();
		} catch (err: any) {
			addLog(`❌ 关闭失败: ${err?.message || JSON.stringify(err)}`);
		}
	};

	// 重新支付
	const regenerateAndPay = async () => {
		if (!realPayState.outTradeNo) {
			ui.showToast({ message: "没有可重新支付的订单" });
			return;
		}

		addLog(`🔄 重新生成支付参数: ${realPayState.outTradeNo}`);

		try {
			const res = await RegeneratePayment(realPayState.outTradeNo);

			const requestPayment = {
				...(res.requestPayment || {})
			};

			payParams.timeStamp = requestPayment.timeStamp;
			payParams.nonceStr = requestPayment.nonceStr;
			payParams.package = requestPayment.package;
			payParams.signType = requestPayment.signType;
			payParams.paySign = requestPayment.paySign;

			addLog(`✅ 重新生成成功，开始支付...`);
			doRealPayment();
		} catch (err: any) {
			addLog(`❌ 重新生成失败: ${err?.message || JSON.stringify(err)}`);
		}
	};

	// 获取订单列表
	const fetchOrderList = async () => {
		addLog(`📋 获取订单列表...`);
		orderListLoading.value = true;

		try {
			const res = await GetOrderList({ page: 1, pageSize: 10 });
			orderList.value = res.orders;
			showOrderList.value = true;
			addLog(`✅ 获取成功，共 ${res.total} 条订单`);
		} catch (err: any) {
			addLog(`❌ 获取失败: ${err?.message || JSON.stringify(err)}`);
		} finally {
			orderListLoading.value = false;
		}
	};

	// 格式化状态
	const formatStatus = (status: string): string => {
		const map: Record<string, string> = {
			PREPAY: "待支付",
			SUCCESS: "已支付",
			unpaid: "未支付",
			CLOSED: "已关闭"
		};
		return map[status] || status;
	};

	// 格式化金额（分转元）
	const formatFee = (fee: number): string => {
		return (fee / 100).toFixed(2);
	};

	// 格式化时间
	const formatTime = (time: string): string => {
		return time?.replace("T", " ").slice(0, 16) || "";
	};

	// 重置状态
	const resetRealPayState = () => {
		realPayState.openid = "";
		realPayState.sessionKey = "";
		realPayState.outTradeNo = "";
		realPayState.step = 1;
		addLog("🔄 已重置支付状态");
	};

	return {
		realPayState,
		payParams,
		packageOptions,
		selectedPackageId,
		orderList,
		orderListLoading,
		showOrderList,
		createRealOrder,
		doRealPayment,
		checkOrderStatus,
		closeCurrentOrder,
		regenerateAndPay,
		fetchOrderList,
		formatStatus,
		formatFee,
		formatTime,
		resetRealPayState
	};
}
