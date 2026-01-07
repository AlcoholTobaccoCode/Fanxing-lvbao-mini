// TODO - 接口有更新
import { request } from "@/cool";

//#region 类型定义

// 获取小程序 open id
export interface WxLoginPayload {
	code: string;
}

export interface WxLoginResponse {
	openid: string;
	session_key: string;
}

// 小程序下单请求参数
export interface JsApiPayload {
	/** 小程序 jscode2session 获取的 openid */
	openid: string;
	/** 套餐id */
	package_id: number;
}

// 小程序下单
export interface JsApiOrder {
	outTradeNo: string;
	userId: number;
	openid: string;
	totalFee: number;
	currency: string;
	status: string;
	prepayId: string;
	transactionId?: any;
	notifyEventId?: any;
	businessType: number;
	description: string;
	createdAt: string;
	updatedAt: string;
}

// 用于调用 wx.requestPayment
export interface JsApiOrderRequestPayment {
	timeStamp: string;
	nonceStr: string;
	package: string;
	signType: string;
	paySign: string;
}

export interface JsApiResponse {
	requestPayment: JsApiOrderRequestPayment;
	order: JsApiOrder;
}

// 订单状态
export type OrderStatus =
	| "CREATED"
	| "PREPAY"
	| "SUCCESS"
	| "CLOSED"
	| "REFUNDING"
	| "REFUNDED"
	| "FAIL";

// 状态筛选
export type OrderSearchStatus = "paid" | "unpaid" | "closed" | "all";

// 获取订单列表请求参数
export interface OrderListParams {
	status?: OrderSearchStatus;
	/** 页码（>=1） */
	page?: number;
	/** 单页条数（1-100） */
	pageSize?: number;
	/** 业务类型筛选，可为空 */
	businessType?: number;
}

// 订单信息
export interface OrderInfo {
	outTradeNo: string;
	userId: number;
	openid: string;
	totalFee: number;
	currency: string;
	status: OrderStatus;
	prepayId: string | null;
	transactionId: string | null;
	notifyEventId: string | null;
	businessType: number;
	description: string | null;
	createdAt: string;
	updatedAt: string;
}

// 订单列表返回数据
export interface OrderListResponse {
	orders: OrderInfo[];
	total: number;
	page: number;
	pageSize: number;
	hasMore: boolean;
}

// 批量关闭超时订单请求参数
export interface CloseExpiredPayload {
	/** 超过多少秒未支付就触发批量关单 */
	ttl_seconds: number;
}

// 批量关闭超时订单返回数据
export interface CloseExpiredResponse {
	success: string[];
	failed: string[];
}

//#endregion

//#region 接口

/**
 * 小程序下单
 * @description 创建微信支付订单，返回调起支付所需参数
 */
export const WxLogin = (data: WxLoginPayload): Promise<WxLoginResponse> => {
	return request({
		url: "/wechat/auth/login",
		method: "POST",
		data
	});
};

/**
 * 小程序下单
 * @description 创建微信支付订单，返回调起支付所需参数
 */
export const CreateJsApiOrder = (data: JsApiPayload): Promise<JsApiResponse> => {
	return request({
		url: "/payments/jsapi",
		method: "POST",
		data
	});
};

/**
 * 查询订单状态
 * @param out_trade_no 商户订单号
 */
export const GetOrderStatus = (out_trade_no: string): Promise<OrderInfo> => {
	return request({
		url: `/payments/${out_trade_no}`,
		method: "GET"
	});
};

/**
 * 关闭订单
 * @description 主动关闭未支付的单笔订单，用于用户取消或超时关单场景
 * @param out_trade_no 需要关闭的订单号
 */
export const CloseOrder = (out_trade_no: string): Promise<any> => {
	return request({
		url: `/payments/${out_trade_no}/close`,
		method: "POST"
	});
};

/**
 * 批量关闭超时订单
 * @description 批量关闭长时间未支付的订单
 */
export const CloseExpiredOrders = (data: CloseExpiredPayload): Promise<CloseExpiredResponse> => {
	return request({
		url: "/payments/close_expired",
		method: "GET",
		data
	});
};

/**
 * 获取用户的订单列表
 * @description 从本地数据库获取用户订单
 */
export const GetOrderList = (params?: OrderListParams): Promise<OrderListResponse> => {
	return request({
		url: "/payments/orders/list",
		method: "GET",
		params
	});
};

/**
 * 基于已有订单重新生成 requestPayment
 * @description 用于订单未支付时重新拉起支付
 * @param out_trade_no 商户订单号
 */
export const RegeneratePayment = (out_trade_no: string): Promise<JsApiResponse> => {
	return request({
		url: `/payments/${out_trade_no}/request_payment`,
		method: "POST"
	});
};

//#endregion
