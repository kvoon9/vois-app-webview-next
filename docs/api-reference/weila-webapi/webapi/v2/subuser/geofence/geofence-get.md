---
title: 获取围栏信息
description: WEBAPI / v2 / subuser管理 / 围栏 · POST http://localhost/v2/subuser/geofence-get
---

# 获取围栏信息

> 目录：WEBAPI / v2 / subuser管理 / 围栏

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/geofence-get` |
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
| user_id | number | 是 | 设备用户ID | 1254040 |

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
		"geofence": {
			"id": 1791946451,
			"name": "哈哈哈",
			"latitude": 22.64604219018539,
			"longitude": 114.0621442030462,
			"radius": 200
		}
	}
}
```

**响应字段**

| 参数 | 类型 | 非空 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| errcode | number |  | 错误码 | 0 |
| errmsg | string |  | 返回文字描述 | 请求成功 |
| data | object | 是 | 返回数据 |  |
| data.geofence | object | 是 |  |  |
| data.geofence.id | number | 是 | 围栏D | 1791946451 |
| data.geofence.enable | number | 是 |  | 1 |
| data.geofence.name | string | 是 | 名称 | 哈哈哈 |
| data.geofence.latitude | number | 是 | 纬度 | 22.64604219018539 |
| data.geofence.longitude | number | 是 | 经度 | 114.0621442030462 |
| data.geofence.radius | number | 是 | 半径(米） | 200 |

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
