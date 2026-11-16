---
title: 解绑设备
description: WEBAPI / v2 / subuser管理 / 设备 · POST http://localhost/v2/subuser/device-unbind
---

# 解绑设备

> 目录：WEBAPI / v2 / subuser管理 / 设备

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/device-unbind` |
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
    "user_id": 1254036
}
```

## 响应示例

### 成功

```json
{
	"errcode": 0,
	"errmsg": "请求成功",
	"data": {
		"friends": [
			{
				"user_id": 441,
				"user_num": "10100464",
				"nick": "翻译测试与",
				"avatar": "http://download.weila.hk/usr/u/441/d784_avt.png?v=1763799331",
				"remark": "",
				"created_at": "2025-10-05"
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
| data.friends | array | 是 |  |  |
| data.friends.user_id | number | 是 | 用户ID | 441 |
| data.friends.user_num | string | 是 | 微喇 | 10100464 |
| data.friends.nick | string | 是 | 用户 | 翻译测试与 |
| data.friends.avatar | string | 是 | 用户 | http://download.weila.hk/usr/u/441/d784_avt.png?v=1763799331 |
| data.friends.remark | string | 是 | 好友备注 |  |
| data.friends.created_at | string | 是 | 注册时间 | 2025-10-05 |

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
