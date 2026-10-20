---
title: 流量卡创建续费订单
description: WEBAPI / v2 / subuser管理 / 流量卡 · POST http://localhost/v2/subuser/simcard-create-renew-order
---

# 流量卡创建续费订单

> 目录：WEBAPI / v2 / subuser管理 / 流量卡

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/simcard-create-renew-order` |
| 示例参数 | `appid=102036&sign=***&et=1788836545&token=***` |

## 请求 Query 参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| appid | string | 是 |  | 102036 |
| sign | string | 是 |  | *** |
| et | string | 是 |  | 1788836545 |
| token | string | 是 |  | *** |

## 请求 Body 示例

```json
{
    "iccid": "8986112124008462514",
    "pay_method": "wechat", // wechat 微信支付 apple_iap 苹果内购
	"pkg_name": "com.voistech.weila"
}
```

## 响应示例

### 成功

```json
{
	"errcode": 0,
	"errmsg": "请求成功",
	"data": {
		"amount": 1,
		"currency": "CNY",
		"order_no": "WSM2026101418102408462514",
		"product_desc": "流量卡续费一年",
		"product_id": "com.voistech.weila.simcard.renew.year",
		"product_name": "流量卡续费一年"
	}
}
```

**响应字段**

| 参数 | 类型 | 非空 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| errcode | number |  | 错误码 | 0 |
| errmsg | string |  | 返回文字描述 | 请求成功 |
| data | object |  | 返回数据 |  |
| data.amount | number | 是 | 金额(分) | 1 |
| data.currency | string | 是 | 货币 | CNY |
| data.order_no | string | 是 | 订单号 | WSM2026101418102408462514 |
| data.product_desc | string | 是 | 订单描述 | 流量卡续费一年 |
| data.product_id | string | 是 | 支付 | com.voistech.weila.simcard.renew.year |
| data.product_name | string | 是 | 产品 | 流量卡续费一年 |

### 失败

```json
{
	"errcode": 31,
	"errmsg": "授权失效"
}
```

**响应字段**

| 参数 | 类型 | 非空 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| errcode | number | 是 | 错误码 | 31 |
| errmsg | string | 是 | 错误描述 | 授权失效 |
