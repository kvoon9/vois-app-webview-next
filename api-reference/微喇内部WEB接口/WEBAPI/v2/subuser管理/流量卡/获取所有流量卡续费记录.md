---
title: 获取所有流量卡续费记录
description: WEBAPI / v2 / subuser管理 / 流量卡 · POST http://localhost/v2/subuser/simcard-get-all-renew-order
---

# 获取所有流量卡续费记录

> 目录：WEBAPI / v2 / subuser管理 / 流量卡

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/simcard-get-all-renew-order` |
| 示例参数 | `appid=102036&sign=***&et=1788836545&token=***` |

## 请求 Query 参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| appid | string | 是 |  | 102036 |
| sign | string | 是 |  | *** |
| et | string | 是 |  | 1788836545 |
| token | string | 是 |  | *** |

## 响应示例

### 成功

```json
{
	"errcode": 0,
	"errmsg": "请求成功",
	"data": {
		"orders": [
			{
				"amount": 1,
				"status": 0,
				"charge_status": 0,
				"order_no": "WSM2026101418102408462514",
				"order_desc": "",
				"iccid": "8986112124008462514",
				"created": "2026-10-14 18:10:24"
			}
		]
	}
}
```

**响应字段**

| 参数 | 类型 | 非空 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| errcode | number |  | 错误码 | 0 |
| errmsg | string |  | 返回文字描述 | 请求成功 |
| data | object |  | 返回数据 |  |
| data.orders | array | 是 |  |  |
| data.orders.amount | number | 是 | 金额(分) | 1 |
| data.orders.status | number | 是 | 支付状态 | 0 |
| data.orders.charge_status | number | 是 | 续费状态 | 0 |
| data.orders.order_no | string | 是 | 订单号 | WSM2026101418102408462514 |
| data.orders.order_desc | string | 是 | 订单描述 |  |
| data.orders.iccid | string | 是 | 流量卡iccid | 8986112124008462514 |
| data.orders.created | string | 是 | 创建时间 | 2026-10-14 18:10:24 |

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
