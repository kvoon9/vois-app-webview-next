---
title: 获取管理员所有好友信息
description: WEBAPI / v2 / subuser管理 / 管理员 · POST http://localhost/v2/subuser/manager-get-all-friend
---

# 获取管理员所有好友信息

> 目录：WEBAPI / v2 / subuser管理 / 管理员

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/manager-get-all-friend` |
| 示例参数 | `appid=102036&sign=***&et=1788836545&token=***` |

## 请求 Query 参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| appid | string | 是 |  | 102036 |
| sign | string | 是 |  | *** |
| et | string | 是 |  | 1788836545 |
| token | string | 是 |  | *** |

## 响应示例

### 成功

```json
{
	"errcode": 0,
	"errmsg": "请求成功",
	"data": {
		"friends": [
			{
				"user_id": 28041,
				"user_num": "10114452",
				"nick": "大宝123",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/avatar/1502701786851345_140489806051_748x750.png",
				"remark": "百度翻译",
				"created_at": "2017-04-13"
			},
			{
				"user_id": 12261,
				"user_num": "10106449",
				"nick": "电影院",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/user_12261_2021-09-30_11-42-51_1-640x640.jpg",
				"remark": "微软翻译对话",
				"created_at": "2016-06-27"
			},
			{
				"user_id": 72,
				"user_num": "10100097",
				"nick": "测试号12",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/avatar/1495421172129624_139909230552_0x0.png",
				"remark": "",
				"created_at": "2015-08-04"
			},
			{
				"user_id": 28781,
				"user_num": "10116443",
				"nick": "蓝天自云",
				"avatar": "",
				"remark": "",
				"created_at": "2017-04-30"
			},
			{
				"user_id": 27991,
				"user_num": "10114424",
				"nick": "红色的巧克11",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/user_27991-2018-05-15-11-30-55-750x750.jpg",
				"remark": "",
				"created_at": "2017-04-12"
			},
			{
				"user_id": 30271,
				"user_num": "10115074",
				"nick": "2号",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/user_30271-2018-04-28-15-22-22-640x640.jpg",
				"remark": "是因为",
				"created_at": "2017-05-17"
			},
			{
				"user_id": 3,
				"user_num": "10000002",
				"nick": "TestNick12",
				"avatar": "http://weilaavatar.oss-cn-shenzhen.aliyuncs.com/usr/u/3/4b5c_avt.png?v=1783394719",
				"remark": "百度闲聊",
				"created_at": "2024-09-23"
			},
			{
				"user_id": 11,
				"user_num": "10100036",
				"nick": "微喇大智",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/avatar/1442402411883430_140222488446.jpg",
				"remark": "",
				"created_at": "2015-07-24"
			},
			{
				"user_id": 1254036,
				"user_num": "300000010531",
				"nick": "wl1254036",
				"avatar": "https://cdn.voischat.cn/weila/avatar/default/user.png",
				"remark": "",
				"created_at": "2026-08-19"
			},
			{
				"user_id": 1254040,
				"user_num": "300000010569",
				"nick": "wl300000010569",
				"avatar": "https://cdn.voischat.cn/weila/avatar/default/user.png",
				"remark": "",
				"created_at": "2026-08-28"
			},
			{
				"user_id": 74,
				"user_num": "10100099",
				"nick": "18600000003",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/avatar/1491982065428236_140489806051.jpg",
				"remark": "",
				"created_at": "2015-08-04"
			},
			{
				"user_id": 76,
				"user_num": "10100101",
				"nick": "0101",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/user_76-2018-03-29-21-02-11-640x640.jpg",
				"remark": "Www ",
				"created_at": "2015-08-04"
			},
			{
				"user_id": 1253338,
				"user_num": "30015775",
				"nick": "wl30015775",
				"avatar": "",
				"remark": "",
				"created_at": "2024-08-06"
			},
			{
				"user_id": 97359,
				"user_num": "10230675",
				"nick": "微软翻译",
				"avatar": "",
				"remark": "",
				"created_at": "2018-05-01"
			},
			{
				"user_id": 10749,
				"user_num": "10105693",
				"nick": "微喇推广",
				"avatar": "",
				"remark": "",
				"created_at": "2016-05-27"
			},
			{
				"user_id": 12259,
				"user_num": "10000003",
				"nick": "炭头",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/user_12259_2021-09-30_10-33-06_1-640x640.0",
				"remark": "",
				"created_at": "2016-06-27"
			},
			{
				"user_id": 10,
				"user_num": "10100035",
				"nick": "微喇小智",
				"avatar": "",
				"remark": "",
				"created_at": "2015-07-24"
			},
			{
				"user_id": 1254037,
				"user_num": "300000010625",
				"nick": "wl300000010625",
				"avatar": "https://cdn.voischat.cn/weila/avatar/default/user.png",
				"remark": "",
				"created_at": "2026-08-27"
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
| data.friends.user_id | number | 是 | 用户ID | 28041 |
| data.friends.user_num | string | 是 | 微喇 | 10114452 |
| data.friends.nick | string | 是 | 用户 | 大宝123 |
| data.friends.avatar | string | 是 | 用户 | https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/avatar/1502701786851345_140489806051_748x750.png |
| data.friends.remark | string | 是 | 好友备注 | 百度翻译 |
| data.friends.created_at | string | 是 | 注册时间 | 2017-04-13 |

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
