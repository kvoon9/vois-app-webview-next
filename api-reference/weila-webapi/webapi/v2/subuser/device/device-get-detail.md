---
title: 获取设备信息
description: WEBAPI / v2 / subuser管理 / 设备 · POST http://localhost/v2/subuser/device-get-detail
---

# 获取设备信息

> 目录：WEBAPI / v2 / subuser管理 / 设备

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/device-get-detail` |
| 示例参数 | `appid=102036&sign=***&et=1788836545&token=***` |

## 请求 Query 参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| appid | string | 是 |  | 102036 |
| sign | string | 是 |  | *** |
| et | string | 是 |  | 1788836545 |
| token | string | 是 |  | *** |

## 请求 Body (JSON)

| 参数 | 类型 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| user_id | number | 是 | 设备用户ID | 1254036 |

## 请求 Body 示例

```json
{
    "user_id": 1254040
}
```

## 响应示例

### 成功

```json
{
	"errcode": 0,
	"errmsg": "请求成功",
	"data": {
		"device": {
			"product": "CF02S",
			"imei": "866507071045308",
			"user_id": 1254036,
			"user_num": "300000010531",
			"sdk_version": "v1.7.1",
			"version": "v1.110",
			"active_at": "2026-08-19",
			"nick": "wl1254036",
			"avatar": "https://cdn.voischat.cn/weila/avatar/default/user.png",
			"location_share": false,
			"location_support": true, //是否支持位置分享
			"reminder_support": true,//是否支持提醒功能
			"online": false,
			"battery": 0, // 电量 0~100 0 电量数据过期 
			"sim_card": {
				"iccid": "8986112124008462514",
				"expiry_date": "2026-10-31",
				"recharge": true
			}
		}
	}
}
```

**响应字段**

| 参数 | 类型 | 非空 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| errcode | number |  | 错误码 | 0 |
| errmsg | string |  | 返回文字描述 | 请求成功 |
| data | object |  | 返回数据 |  |
| data.device | object | 是 |  |  |
| data.device.product | string | 是 | 产品名称 | CF02S |
| data.device.imei | string | 是 | IMEI | 866507071045308 |
| data.device.user_id | number | 是 | 设备用户ID | 1254036 |
| data.device.user_num | string | 是 | 设备微喇 | 300000010531 |
| data.device.sdk_version | string | 是 | 设备SDK版本 | v1.7.1 |
| data.device.version | string | 是 | 设备版本 | v1.110 |
| data.device.active_at | string | 是 | 设备激活时间 | 2026-08-19 |
| data.device.nick | string | 是 | 昵称 | wl1254036 |
| data.device.avatar | string | 是 | 头像 | https://cdn.voischat.cn/weila/avatar/default/user.png |
| data.device.location_share | boolean | 是 | 位置共享 | false |
| data.device.location_support | boolean | 是 | 是否支持位置分享 | true |
| data.device.reminder_support | boolean | 是 | 是否支持提醒功能 | true |
| data.device.online | boolean | 是 | 在线状态 | false |
| data.device.battery | number | 是 | 电量 0~100 0 电量数据过期 | 0 |
| data.device.sim_card | object | 是 | 流量卡信息 |  |
| data.device.sim_card.iccid | string | 是 | ICCID | 8986112124008462514 |
| data.device.sim_card.expiry_date | string | 是 | 流量卡过期 | 2026-10-31 |
| data.device.sim_card.recharge | boolean | 是 | 是否可以续费 | true |

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
