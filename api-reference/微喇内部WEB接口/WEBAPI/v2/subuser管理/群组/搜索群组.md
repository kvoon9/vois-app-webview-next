---
title: 搜索群组
description: WEBAPI / v2 / subuser管理 / 群组 · POST http://localhost/v2/subuser/group-search
---

# 搜索群组

> 目录：WEBAPI / v2 / subuser管理 / 群组

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/group-search` |
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
| key | string | 是 | 群号 | 101239 |

## 请求 Body 示例

```json
{
    "user_id": 1254036,
    "key": "132349"
}
```

## 响应示例

### 成功

```json
{
	"errcode": 0,
	"errmsg": "请求成功",
	"data": {
		"groups": [
			{
				"group_id": 7364,
				"num": "101239",
				"name": "房管局",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/group/user_441_2023-03-09_19-37-32_8-640x640.jpg",
				"is_creator": false,
				"is_admin": false,
				"is_audit": false
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
| data.groups | array | 是 |  |  |
| data.groups.group_id | number | 是 | 群ID | 7364 |
| data.groups.num | string | 是 | 群 | 101239 |
| data.groups.name | string | 是 | 群名 | 房管局 |
| data.groups.avatar | string | 是 | 群 | https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/group/user_441_2023-03-09_19-37-32_8-640x640.jpg |
| data.groups.is_creator | boolean | 是 | 是否群主 | false |
| data.groups.is_admin | boolean | 是 | 是否管理员 | false |
| data.groups.is_audit | boolean | 是 | 是否需要审核 | false |

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
