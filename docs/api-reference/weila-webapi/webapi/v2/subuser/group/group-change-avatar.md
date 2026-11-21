---
title: 修改群头像
description: WEBAPI / v2 / subuser管理 / 群组 · POST http://localhost/v2/subuser/group-change-avatar
---

# 修改群头像

> 目录：WEBAPI / v2 / subuser管理 / 群组

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/group-change-avatar` |
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
| avatar | string | 是 | 头像URL | https://weila.oss-cn-shenzhen.aliyuncs.com/avatar/user/1002602/16ef1c53.jpg |

## 请求 Body 示例

```json
{
    "user_id": 1254036,
    "group_id": 29448,
    "avatar": "https://weila.oss-cn-shenzhen.aliyuncs.com/avatar/user/1002602/16ef1c53.jpg"
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

**响应字段**

| 参数 | 类型 | 非空 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| errcode | number |  | 错误码 | 0 |
| errmsg | string |  | 返回文字描述 | 请求成功 |

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
