---
title: 群成员获取所有成员信息
description: WEBAPI / v2 / subuser管理 / 群组 · POST http://localhost/v2/subuser/group-member-get-all
---

# 群成员获取所有成员信息

> 目录：WEBAPI / v2 / subuser管理 / 群组

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/group-member-get-all` |
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
| user_id | number | 是 | 用户ID | 1254036 |
| group_id | number | 是 | 群ID | 29448 |

## 请求 Body 示例

```json
{
    "user_id": 1254036,
    "group_id": 29429
}
```

## 响应示例

### 成功

```json
{
	"errcode": 0,
	"errmsg": "请求成功",
	"data": {
		"members": [
			{
				"user_id": 441,
				"user_num": "10100464",
				"nick": "翻译测试与",
				"avatar": "http://download.weila.hk/usr/u/441/d784_avt.png?v=1763799331",
				"remark": "",
				"is_admin": true,
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
| data.members | array | 是 |  |  |
| data.members.user_id | number | 是 | 用户 | 441 |
| data.members.user_num | string | 是 | 微喇 | 10100464 |
| data.members.nick | string | 是 | 用户 | 翻译测试与 |
| data.members.avatar | string | 是 | 用户头像 | http://download.weila.hk/usr/u/441/d784_avt.png?v=1763799331 |
| data.members.remark | string | 是 | 成员群昵称 |  |
| data.members.is_admin | boolean | 是 | 是否管理员 | true |
| data.members.created_at | string | 是 | 用户注册时间 | 2025-10-05 |

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
