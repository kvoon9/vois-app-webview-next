---
title: 获取管理员所有群组信息
description: WEBAPI / v2 / subuser管理 / 管理员 · POST http://localhost/v2/subuser/manager-get-all-group
---

# 获取管理员所有群组信息

> 目录：WEBAPI / v2 / subuser管理 / 管理员

## 基本信息

| 项 | 值 |
| --- | --- |
| 请求方法 | `POST` |
| 请求地址 | `http://localhost/v2/subuser/manager-get-all-group` |
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
		"groups": [
			{
				"group_id": 62,
				"num": "",
				"name": "微喇",
				"avatar": "",
				"is_creator": false,
				"is_admin": false,
				"is_audit": false
			},
			{
				"group_id": 7364,
				"num": "101239",
				"name": "房管局",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/group/user_441_2023-03-09_19-37-32_8-640x640.jpg",
				"is_creator": false,
				"is_admin": true,
				"is_audit": false
			},
			{
				"group_id": 28095,
				"num": "114764",
				"name": "A3测试",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/group/user_441_2026-01-16_17-37-55_3-640x640.jpg",
				"is_creator": false,
				"is_admin": true,
				"is_audit": false
			},
			{
				"group_id": 29007,
				"num": "132048",
				"name": "软件测试",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/group/user_143759_2021-12-30_16-37-08_3-640x640.jpg",
				"is_creator": false,
				"is_admin": false,
				"is_audit": false
			},
			{
				"group_id": 29028,
				"num": "132059",
				"name": "我的待机组",
				"avatar": "https://weilaavatar.oss-cn-shenzhen.aliyuncs.com/group/user_143760_2022-05-09_19-26-41_1-480x640.jpg",
				"is_creator": false,
				"is_admin": false,
				"is_audit": false
			},
			{
				"group_id": 29122,
				"num": "135979",
				"name": "4444123",
				"avatar": "http://favicon.weila.hk/default/session.png",
				"is_creator": false,
				"is_admin": false,
				"is_audit": true
			},
			{
				"group_id": 29304,
				"num": "132162",
				"name": "1111",
				"avatar": "",
				"is_creator": false,
				"is_admin": false,
				"is_audit": false
			},
			{
				"group_id": 29307,
				"num": "132165",
				"name": "测试123",
				"avatar": "http://download.weila.hk/usr/g/29307/9bc1_avt.png?v=1764809583",
				"is_creator": true,
				"is_admin": true,
				"is_audit": false
			},
			{
				"group_id": 29308,
				"num": "132167",
				"name": "share",
				"avatar": "http://download.weila.hk/usr/g/29308/b334_avt.png?v=1764817989",
				"is_creator": true,
				"is_admin": true,
				"is_audit": false
			},
			{
				"group_id": 29309,
				"num": "132169",
				"name": "share",
				"avatar": "http://download.weila.hk/usr/g/29309/34a2_avt.png?v=1764817994",
				"is_creator": true,
				"is_admin": true,
				"is_audit": false
			},
			{
				"group_id": 29425,
				"num": "",
				"name": "1811111",
				"avatar": "",
				"is_creator": true,
				"is_admin": true,
				"is_audit": false
			},
			{
				"group_id": 29429,
				"num": "132349",
				"name": "等会等会多久",
				"avatar": "",
				"is_creator": true,
				"is_admin": true,
				"is_audit": false
			},
			{
				"group_id": 29436,
				"num": "132357",
				"name": "吃吃饭",
				"avatar": "",
				"is_creator": false,
				"is_admin": false,
				"is_audit": false
			},
			{
				"group_id": 29437,
				"num": "132358",
				"name": "好好回家",
				"avatar": "",
				"is_creator": false,
				"is_admin": false,
				"is_audit": false
			},
			{
				"group_id": 29439,
				"num": "132360",
				"name": "DeviceTest",
				"avatar": "http://download.weila.hk/usr/g/29439/ee61_avt.png?v=1778569372",
				"is_creator": false,
				"is_admin": false,
				"is_audit": false
			},
			{
				"group_id": 29446,
				"num": "133818",
				"name": "UpdatedTestGroup2",
				"avatar": "http://weilaavatar.oss-cn-shenzhen.aliyuncs.com/usr/g/29446/724a_avt.png?v=1783144161",
				"is_creator": false,
				"is_admin": false,
				"is_audit": true
			},
			{
				"group_id": 29448,
				"num": "139949",
				"name": "你好,你叫什么名字,收到请回答,修改群头像,你好,你叫什么名字",
				"avatar": "http://weilaavatar.oss-cn-shenzhen.aliyuncs.com/usr/g/29448/a64d_avt.jpg?v=1788944714",
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
| data.groups.group_id | number | 是 | 群ID | 62 |
| data.groups.num | string | 是 | 群 |  |
| data.groups.name | string | 是 | 群名 | 微喇 |
| data.groups.avatar | string | 是 | 群 |  |
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
