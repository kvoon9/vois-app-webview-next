---
title: 添加提醒
description: WEBAPI / v2 / subuser管理 / 提醒 · POST http://localhost/v2/subuser/reminder-add
---

# 添加提醒

> 目录：WEBAPI / v2 / subuser管理 / 提醒

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/reminder-add` |
| 示例参数 | `appid=102036&et=1741491127&sign=***&token=***` |

## 请求 Query 参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| appid | string | 是 |  | 102036 |
| et | string | 是 |  | 1741491127 |
| sign | string | 是 |  | *** |
| token | string | 是 |  | *** |

## 请求 Body (JSON)

| 参数 | 类型 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| user_id | number | 是 | 设备用户Id | 1254040 |
| name | string | 是 | 名称 | 3点吃药 |
| repeated_type | number | 是 | 0 单次 1 每天 2 每周 3 每月 | 0 |
| repeated | array | 是 | []表示不重复1~7周一至周日 1~31表示日期 |  |
| duration | number | 是 | 持续时长 | 60 |
| again_interval | number | 是 | 重复间隔时间 | 300 |
| again_times | number | 是 | 重复次数 | 3 |
| reminder | string | 是 | 触发时间 | 16:00 |

## 请求 Body 示例

```json
{
    "user_id": 1254040, //设备用户Id
    "name": "3点吃药",
    "repeated_type": 0,// 0 单次 1 每天 2 每周 3 每月
    "repeated": [], //[]表示不重复1~7周一至周日 1~31表示日期
    "duration": 60,
    "again_interval": 300,
    "again_times": 0,
    "reminder": "16:00"
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
