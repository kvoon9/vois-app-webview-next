---
title: 获取轨迹
description: WEBAPI / v2 / subuser管理 / 轨迹 · POST http://localhost/v2/subuser/track-get
---

# 获取轨迹

> 目录：WEBAPI / v2 / subuser管理 / 轨迹

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/track-get` |
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
    "user_id": 1254040,
    "date": "2026-10-14"
}
```

## 响应示例

### 成功

```json
{
	"errcode": 0,
	"errmsg": "请求成功",
	"data": {
		"tracks": [
			{
				"lat": 22.647144,
				"lng": 114.06487,
				"radius": 0,
				"type": 0,
				"ts": 1791954483
			},
			{
				"lat": 22.646904,
				"lng": 114.06396,
				"radius": 0,
				"type": 0,
				"ts": 1791950883
			},
			{
				"lat": 22.647423,
				"lng": 114.06298,
				"radius": 0,
				"type": 0,
				"ts": 1791947263
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
| data.tracks | array | 是 |  |  |
| data.tracks.lat | number | 是 | 纬度 | 22.647144 |
| data.tracks.lng | number | 是 | 经度 | 114.06487 |
| data.tracks.radius | number | 是 | 精度半径(米) | 0 |
| data.tracks.type | number | 是 | 坐标类型 0 gcj02 1 wsg64 | 0 |
| data.tracks.ts | number | 是 | 定位时间 | 1791954483 |

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
