---
title: 获取所有提醒
description: WEBAPI / v2 / subuser管理 / 提醒 · POST http://localhost/v2/subuser/reminder-get-all
---

# 获取所有提醒

> 目录：WEBAPI / v2 / subuser管理 / 提醒

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/reminder-get-all` |
| 示例参数 | `appid=102036&et=1741491127&sign=***&token=***` |

## 请求 Query 参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| appid | string | 是 |  | 102036 |
| et | string | 是 |  | 1741491127 |
| sign | string | 是 |  | *** |
| token | string | 是 |  | *** |

## 请求 Body 示例

```json
{
    "user_id": 1254040 //设备用户Id
}
```

## 响应示例

### 成功

```json
{
	"errcode": 0,
	"errmsg": "请求成功",
	"data": {
		"reminders": [
			{
				"id": 4,
				"user_id": 3,
				"name": "3点吃药",
				"repeated": [
					0,
					1,
					2,
					3,
					4,
					5,
					6
				],
				"duration": 60,
				"again_interval": 300,
				"again_times": 3,
				"reminder": "16:00"
			}
		]
	}
}
```

**响应字段**

| 参数 | 类型 | 非空 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| errcode | number | 是 |  | 0 |
| errmsg | string | 是 | 返回文字描述 | 请求成功 |
| data | object | 是 | 返回数据 |  |
| data.reminders | array | 是 |  |  |
| data.reminders.id | number | 是 |  | 4 |
| data.reminders.user_id | number | 是 | 设备用户ID | 3 |
| data.reminders.name | string | 是 |  | 3点吃药 |
| data.reminders.repeated | array | 是 | []表示不重复1~7周一至周日 1~31表示日期 |  |
| data.reminders.duration | number | 是 | 持续时长 | 60 |
| data.reminders.again_interval | number | 是 | 重复间隔时间 | 300 |
| data.reminders.again_times | number | 是 | 重复次数 | 3 |
| data.reminders.reminder | string | 是 | 触发时间 | 16:00 |

### 失败

```json
{
	"errcode": 0,
	"errmsg": "请求成功",
	"data": {
		"business": null
	}
}
```
