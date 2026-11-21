---
title: 获取管理员所有设备信息
description: WEBAPI / v2 / subuser管理 / 管理员 · POST http://localhost/v2/subuser/manager-get-all-device
---

# 获取管理员所有设备信息

> 目录：WEBAPI / v2 / subuser管理 / 管理员

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/manager-get-all-device` |
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
		"devices": [
			{
				"product": "CF03",
				"imei": "866507071045311",
				"user_id": 1254040,
				"user_num": "300000010569",
				"sdk_version": "v1.8.2",
				"version": "v1.110",
				"active_at": "2026-08-28",
				"nick": "wl300000010569",
				"avatar": "https://cdn.voischat.cn/weila/avatar/default/user.png",
				"location_share": true,
				"location_support": true, //是否支持位置分享
				"reminder_support": true, //是否支持提醒功能
				"online": false,
				"battery": 0, // 电量 0~100 0 电量数据过期 
				"sim_card": {
					"iccid": "8986112224604921600",
					"expiry_date": "2027-11-30",
					"recharge": false
				}
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
| data.devices | array | 是 |  |  |
| data.devices.product | string | 是 | 产品名称 | CF03 |
| data.devices.imei | string | 是 | 设备IMEI | 866507071045311 |
| data.devices.user_id | number | 是 | 设备用户ID | 1254040 |
| data.devices.user_num | string | 是 | 微喇 | 300000010569 |
| data.devices.sdk_version | string | 是 | 升级版本号 | v1.8.2 |
| data.devices.version | string | 是 | 升级版本号 | v1.110 |
| data.devices.active_at | string | 是 | 激活时间 | 2026-08-28 |
| data.devices.nick | string | 是 | 昵称 | wl300000010569 |
| data.devices.avatar | string | 是 | 头像URL | https://cdn.voischat.cn/weila/avatar/default/user.png |
| data.devices.location_share | boolean | 是 | 位置共享开关 | true |
| data.devices.location_support | boolean | 是 | 是否支持位置分享 | true |
| data.devices.reminder_support | boolean | 是 | 是否支持提醒功能 | true |
| data.devices.online | boolean | 是 | 在线状态 | false |
| data.devices.battery | number | 是 | 电量 0~100 0 电量数据过期 | 0 |
| data.devices.sim_card | object | 是 | 流量卡 |  |
| data.devices.sim_card.iccid | string | 是 | 流量卡ICCID | 8986112224604921600 |
| data.devices.sim_card.expiry_date | string | 是 | 日期时间 | 2027-11-30 |
| data.devices.sim_card.recharge | boolean | 是 | 是否需要充值 | false |

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
