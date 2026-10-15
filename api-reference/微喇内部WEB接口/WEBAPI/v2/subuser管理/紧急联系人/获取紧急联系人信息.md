---
title: 获取紧急联系人信息
description: WEBAPI / v2 / subuser管理 / 紧急联系人 · POST http://localhost/v2/subuser/emergency-contact-get
---

# 获取紧急联系人信息

> 目录：WEBAPI / v2 / subuser管理 / 紧急联系人

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/emergency-contact-get` |
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
		"contacts": [
			{
				"avatar": "",
				"id": 0,
				"name": "张三",
				"number": "18675500568",
				"type": 1
			},
			{
				"avatar": "",
				"id": 74,
				"name": "18600000003",
				"number": "10100099",
				"type": 2
			}
		],
		"sos_friend_limit": 3,
		"sos_phone_limit": 2,
		"sos_times": 5
	}
}
```

**响应字段**

| 参数 | 类型 | 非空 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| errcode | number |  | 错误码 | 0 |
| errmsg | string |  | 返回文字描述 | 请求成功 |
| data | object | 是 | 返回数据 |  |
| data.contacts | array | 是 |  |  |
| data.contacts.avatar | string | 是 | 联系人头像(微喇好友有效) |  |
| data.contacts.id | number | 是 | 微喇好友为 | 0 |
| data.contacts.name | string | 是 | 昵称 | 张三 |
| data.contacts.number | string | 是 | 微喇号或手机号 | 18675500568 |
| data.contacts.type | number | 是 | 类型 1 手机联系人 2 好友联系人 | 1 |
| data.sos_friend_limit | number | 是 | 告警好友最大数量 | 3 |
| data.sos_phone_limit | number | 是 | 告警手机号最大数量 | 2 |
| data.sos_times | number | 是 | 手机号告警剩余次数 | 5 |

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
