---
title: 获取所有需要续费流量卡
description: WEBAPI / v2 / subuser管理 / 流量卡 · POST http://localhost/v2/subuser/simcard-get-all-need-renew
---

# 获取所有需要续费流量卡

> 目录：WEBAPI / v2 / subuser管理 / 流量卡

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/simcard-get-all-need-renew` |
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
		"renews": [
			{
				"iccid": "8986112124008462514",
				"expiry_date": "2026-10-31",
				"product": "CF02S",
				"imei": "866507071045308",
				"user_num": "300000010531",
				"user_nick": "张三"
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
| data.renews | array | 是 |  |  |
| data.renews.iccid | string | 是 | 流量卡ICCID | 8986112124008462514 |
| data.renews.expiry_date | string | 是 | 日期时间 | 2026-10-31 |
| data.renews.product | string | 是 | 设备型号 | CF02S |
| data.renews.imei | string | 是 | 设备IMEI | 866507071045308 |
| data.renews.user_num | string | 是 | 设备微喇号 | 300000010531 |
| data.renews.user_nick | string | 是 | 设备昵称 | 张三 |

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
