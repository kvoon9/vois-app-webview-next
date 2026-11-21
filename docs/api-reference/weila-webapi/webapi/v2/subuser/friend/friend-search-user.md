---
title: 搜索用户
description: WEBAPI / v2 / subuser管理 / 好友 · POST http://localhost/v2/subuser/friend-search-user
---

# 搜索用户

> 目录：WEBAPI / v2 / subuser管理 / 好友

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/friend-search-user` |
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
| key | string | 是 | 微喇号或手机号 | 101239 |

## 请求 Body 示例

```json
{
    "user_id": 1254036,
    "key": "18675500568"
}
```

## 响应示例

### 成功

```json
{
	"errcode": 0,
	"errmsg": "请求成功",
	"data": {
		"users": [
			{
				"user_id": 3,
				"user_num": "10000002",
				"nick": "TestNick12",
				"avatar": "https://cdn.voischat.cn/weilachat/usr/u/3/4b5c_avt.jpg?v=1791533349",
				"remark": "",
				"created_at": "2024-09-23"
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
| data.users | array | 是 |  |  |
| data.users.user_id | number | 是 | 用户ID | 3 |
| data.users.user_num | string | 是 | 微喇号 | 10000002 |
| data.users.nick | string | 是 | 昵称 | TestNick12 |
| data.users.avatar | string | 是 | 头像 | https://cdn.voischat.cn/weilachat/usr/u/3/4b5c_avt.jpg?v=1791533349 |
| data.users.remark | string | 是 | 备注 |  |
| data.users.created_at | string | 是 | 创建 | 2024-09-23 |

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
