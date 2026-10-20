---
title: 群申请待审核信息
description: WEBAPI / v2 / subuser管理 / 群组 · POST http://localhost/v2/subuser/group-get-all-join-audit
---

# 群申请待审核信息

> 目录：WEBAPI / v2 / subuser管理 / 群组

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/group-get-all-join-audit` |
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
| user_id | number | 是 | 用户 | 1254036 |
| group_id | number | 是 | 群ID | 62 |
| member_ids | array | 是 | 被邀请好友用户ID |  |

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
		"audits": [
			{
				"group_id": 29429,
				"group_num": "132349",
				"group_name": "等会等会多久",
				"user_id": 1254036,
				"user_num": "",
				"user_nick": "",
				"detail": "我是:翻译测试与",
				"status": 0,
				"created_at": "2026-09-10 11:05:35"
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
| data | object | 是 | 返回数据 |  |
| data.audits | array | 是 |  |  |
| data.audits.group_id | number | 是 | 群ID | 29429 |
| data.audits.group_num | string | 是 | 群 | 132349 |
| data.audits.group_name | string | 是 | 群名 | 等会等会多久 |
| data.audits.user_id | number | 是 | 申请人用户 | 1254036 |
| data.audits.user_num | string | 是 | 申请人微喇号 |  |
| data.audits.user_nick | string | 是 | 申请人昵称 |  |
| data.audits.detail | string | 是 | 申请原因 | 我是:翻译测试与 |
| data.audits.status | number | 是 | 状态 0 未处理 1 同意 2  | 0 |
| data.audits.created_at | string | 是 | 请求 | 2026-09-10 11:05:35 |

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
