---
title: 删除提醒
description: WEBAPI / v2 / subuser管理 / 提醒 · POST http://localhost/v2/subuser/reminder-delete
---

# 删除提醒

> 目录：WEBAPI / v2 / subuser管理 / 提醒

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/reminder-delete` |
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
    "user_id": 1254040, //设备用户Id
    "reminder_ids": [5]
}
```

## 响应示例

### 成功

```json
{
	"errcode": 0,
	"errmsg": "请求成功"
}
```

### 失败

```json
{
	"errcode": 43610,
	"errmsg": "认证信息不存在"
}
```
