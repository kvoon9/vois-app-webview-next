# API 需求文档（Webview 前端 → 后端）

> 本文档整理自前端 mock 服务（`apps/mock-server`）中已实现的接口，供后端实现参考。
> 所有接口均为 **POST** 请求，路径统一前缀 `/v2`，请求/响应均为 **JSON**。

## 通用约定

### 响应包装

所有接口返回统一包装结构：

```jsonc
{ "errcode": 0, "errmsg": "", "data": { ... } }
```

- `errcode: number` — `0` 表示成功，非 `0` 表示失败
- `errmsg: string` — 失败时的错误描述（中文），成功为空字符串
- `data: object` — 业务数据，失败时为 `{}`

### 通用类型

```jsonc
// 通用设置（群组 / 联系人均使用）
GroupSettings | ContactSettings = {
  muted: boolean          // 消息免打扰
  share_location: boolean // 共享位置
  broadcast: boolean      // 广播
  pinned: boolean         // 置顶
}

// 用户（好友 / 成员列表项均含以下基础字段）
UserBase = {
  user_id: number
  user_num: string      // 微信号之类的账号
  nick: string          // 昵称
  avatar: string        // 头像 URL
  online: boolean
  signature: string     // 个性签名
  registered_at: string // 注册时间 "YYYY-MM-DD HH:mm:ss"
}
```

---

## 1. 设备

### 1.1 获取已连接设备列表

`POST /v2/device/list-connected`

**Body**：无

**Response** `data`：

```jsonc
{
  "devices": [
    {
      "user_id": 101,
      "user_num": "V1010001",
      "nick": "工作手机",
      "avatar": "https://...",
      "product": "VoiS Pro 5",
      "imei": "867530900001001",
      "version": "3.6.1",
      "activated_at": "2025-01-18 09:30:00",
      "online": true,
      "share_location": true,
    },
  ],
}
```

### 1.2 更新设备信息

`POST /v2/device/update`

**Body**（字段均可选，传了才更新）：

| 字段             | 类型    | 说明          |
| ---------------- | ------- | ------------- |
| `device_id`      | number  | 必填，设备 ID |
| `nick`           | string  | 设备昵称      |
| `avatar`         | string  | 设备头像 URL  |
| `share_location` | boolean | 是否共享位置  |

**Response** `data`：`{}`

### 1.3 获取设备加入的群组列表

`POST /v2/device/groups`

**Body**：`{ "device_id": 101 }`

**Response** `data`：

```jsonc
{
  "groups": [
    {
      "group_id": 1001,
      "num": "7001001",
      "name": "G1",
      "avatar": "https://...",
      "created_by_me": true,
    },
  ],
}
```

### 1.4 设备加入群组

`POST /v2/device/join-group`

**Body**：`{ "device_id": 101, "group_id": 1001 }`

**Response** `data`：`{}`

### 1.5 设备退出群组

`POST /v2/device/leave-group`

**Body**：`{ "device_id": 101, "group_id": 1001 }`

**Response** `data`：`{}`

### 1.6 清空聊天记录

`POST /v2/device/clear-messages`

**Body**：`{ "device_id": 101, "contact_id": 2001 }`

**Response** `data`：`{}`

---

## 2. 设备联系人

### 2.1 获取设备联系人列表

`POST /v2/device/contacts`

**Body**：`{ "device_id": 101 }`

**Response** `data`：

```jsonc
{
  "contacts": [
    {
      "user_id": 2001,
      "user_num": "2000001",
      "nick": "小满",
      "avatar": "https://...",
      "online": true,
      "registered_at": "2024-02-01 08:00:00",
      "signature": "正在输入中",
      "settings": { "muted": false, "share_location": false, "broadcast": false, "pinned": false },
      "remark": "同事",
    },
  ],
}
```

### 2.2 添加设备联系人

`POST /v2/device/add-contacts`

**Body**：`{ "device_id": 101, "contact_ids": [2003, 2004] }`

**Response** `data`：`{}`

### 2.3 删除设备联系人

`POST /v2/device/remove-contact`

**Body**：`{ "device_id": 101, "contact_id": 2001 }`

**Response** `data`：`{}`

### 2.4 更新联系人设置

`POST /v2/device/update-contact-settings`

**Body**（除 `device_id`、`contact_id` 外均可选，传了才更新）：

| 字段                                                | 类型        |
| --------------------------------------------------- | ----------- |
| `device_id`                                         | number      |
| `contact_id`                                        | number      |
| `muted` / `share_location` / `broadcast` / `pinned` | boolean     |
| `remark`                                            | string 备注 |

**Response** `data`：`{}`

---

## 3. 群组

### 3.1 我创建的群组

`POST /v2/group/my-created`

**Body**：无

**Response** `data`：`{ "groups": [CompactGroup] }`，同 1.3 中 `groups` 数组项。

### 3.2 我加入的群组（非我创建）

`POST /v2/group/my-joined`

**Body**：无

**Response** `data`：`{ "groups": [CompactGroup] }`

### 3.3 搜索群组

`POST /v2/group/search`

**Body**：`{ "keyword": "7001" }` — 按群号 `num` 模糊匹配

**Response** `data`：`{ "groups": [CompactGroup] }`

### 3.4 群组详情

`POST /v2/group/info`

**Body**：`{ "group_id": 1001 }`

**Response** `data`：

```jsonc
{
  "group": {
    "group_id": 1001,
    "num": "7001001",
    "name": "G1",
    "avatar": "https://...",
    "created_by_me": true,
    "intro": "一起交流和分享生活。",
    "created_at": "2024-03-12 10:20:00",
    "member_count": 9,
    "settings": { "muted": false, "share_location": false, "broadcast": false, "pinned": false },
    "my_nickname": "林舟", // 我在该群的群昵称
  },
}
```

### 3.5 获取群成员列表

`POST /v2/group/members`

**Body**：`{ "group_id": 1001 }`

**Response** `data`：

```jsonc
{
  "members": [
    {
      "user_id": 1,
      "user_num": "10000001",
      "nick": "林舟",
      "avatar": "https://...",
      "role": "owner", // "owner" | "admin" | "member"
      "online": true,
      "signature": "保持热爱，奔赴山海。",
      "nickname": "林舟", // 群昵称
    },
  ],
}
```

### 3.6 添加群成员

`POST /v2/group/add-members`

**Body**：`{ "group_id": 1001, "member_ids": [2003, 2004] }`

**Response** `data`：`{}`

### 3.7 移除群成员

`POST /v2/group/remove-member`

**Body**：`{ "group_id": 1001, "member_id": 2003 }`

**Response** `data`：`{}`

### 3.8 修改群信息（仅群主）

`POST /v2/group/update`

**Body**（除 `group_id` 外均可选）：

| 字段       | 类型   |
| ---------- | ------ |
| `group_id` | number |
| `name`     | string |
| `intro`    | string |
| `avatar`   | string |

**Response** `data`：`{}`（非群主返回 errcode 1）

### 3.9 修改我的群昵称

`POST /v2/group/update-my-nickname`

**Body**：`{ "group_id": 1001, "nickname": "小舟" }`

**Response** `data`：`{}`

### 3.10 解散群组（仅群主）

`POST /v2/group/dissolve`

**Body**：`{ "group_id": 1001 }`

**Response** `data`：`{}`

### 3.11 修改群设置

`POST /v2/group/update-settings`

**Body**（除 `group_id` 外均可选）：`group_id` + `muted` / `share_location` / `broadcast` / `pinned`（boolean）

**Response** `data`：`{}`

---

## 4. 好友 / 用户

### 4.1 好友列表

`POST /v2/friend/list`

**Body**：无

**Response** `data`：

```jsonc
{ "friends": [UserBase] } // 数组项同「通用类型 UserBase」
```

### 4.2 搜索用户

`POST /v2/user/search`

**Body**：`{ "keyword": "2000" }` — 按用户 `user_num` 模糊匹配

**Response** `data`：`{ "users": [UserBase] }`

---

## 5. 位置 / 轨迹

### 5.1 设备最新位置

`POST /v2/device/location`

**Body**：`{ "device_id": 101 }`

**Response** `data`：

```jsonc
{
  "lng": 114.0684,
  "lat": 22.6295,
  "updated_at": "2026-09-04 10:28:00",
  "report_frequency": "off", // "off" | "low" | "mid" | "high"
  // 电子围栏，可为 null
  "fence": { "lng": 114.0668, "lat": 22.6305, "radius": 980 },
}
```

### 5.2 设备某天轨迹

`POST /v2/device/track`

**Body**：`{ "device_id": 101, "date": "2026-09-02" }`

**Response** `data`：

```jsonc
{
  "points": [{ "lng": 114.0612, "lat": 22.6344, "time": "08:12:00" }],
}
```

### 5.3 修改轨迹上报频率

`POST /v2/device/update-track-setting`

**Body**：`{ "device_id": 101, "frequency": "low" }` — `frequency`: `"off" | "low" | "mid" | "high"`

**Response** `data`：`{}`

---

## 6. 紧急联系人

### 6.1 获取紧急联系人列表

`POST /v2/device/emergency-contacts`

**Body**：`{ "device_id": 101 }`

**Response** `data`：

```jsonc
{
  "contacts": [
    // type === "friend"（从好友中选择，带用户信息）
    {
      "contact_id": 5001,
      "type": "friend",
      "user_id": 2001,
      "user_num": "2000001",
      "nick": "小满",
      "avatar": "https://...",
      "name": "小满",
      "phone": "13800002001",
    },
    // type === "phone"（手动填写，无用户信息）
    { "contact_id": 5002, "type": "phone", "name": "爸爸", "phone": "13900001111" },
  ],
  "quota": { "friend_max": 3, "phone_max": 2, "sos_remaining": 5 },
}
```

### 6.2 从好友添加紧急联系人

`POST /v2/device/add-emergency-friends`

**Body**：`{ "device_id": 101, "contact_ids": [2002, 2003] }`

超过 `friend_max` 上限时返回 errcode 1。

**Response** `data`：`{}`

### 6.3 添加电话紧急联系人

`POST /v2/device/add-emergency-phone`

**Body**：`{ "device_id": 101, "name": "爸爸", "phone": "13900001111" }`

超过 `phone_max` 上限时返回 errcode 1。

**Response** `data`：`{}`

### 6.4 删除紧急联系人

`POST /v2/device/remove-emergency-contact`

**Body**：`{ "device_id": 101, "contact_id": 5001 }`

**Response** `data`：`{}`

---

## 7. 提醒

### 7.1 获取提醒列表

`POST /v2/device/reminders`

**Body**：`{ "device_id": 101 }`

**Response** `data`：

```jsonc
{
  "reminders": [
    {
      "reminder_id": 6001,
      "time": "17:32", // "HH:mm"
      "content": "该吃药了",
      "repeat": "once", // "once" | "daily" | "weekdays"
      "ring_duration": 30, // 响铃时长（秒），枚举: 30/60/120/180/300/600
      "repeat_count": 3, // 重复次数，枚举: 0/1/2/3/5/10
      "repeat_interval": 5, // 重复间隔（分钟），枚举: 1/2/3/5/10
    },
  ],
}
```

### 7.2 创建提醒

`POST /v2/device/create-reminder`

**Body**：`device_id` + 7.1 中除 `reminder_id` 外的全部字段（服务端校验枚举值，非法返回 errcode 1）

**Response** `data`：`{ "reminder_id": 6002 }`

### 7.3 更新提醒

`POST /v2/device/update-reminder`

**Body**：`reminder_id` + 7.2 中除 `device_id` 外的全部字段

**Response** `data`：`{}`

### 7.4 删除提醒

`POST /v2/device/remove-reminder`

**Body**：`{ "reminder_id": 6001 }`

**Response** `data`：`{}`

---

## 8. 充值

### 8.1 可充值设备列表

`POST /v2/device/recharge-list`

**Body**：无

**Response** `data`：

```jsonc
{
  "devices": [
    {
      "user_id": 101,
      "nick": "工作手机",
      "product": "VoiS Pro 5",
      "imei": "867530900001001",
      "iccid": "8986001234567890001",
      "expire_at": "2026-12-31 23:59:59",
      "price": 30, // 续费价格（元）
    },
  ],
}
```

### 8.2 创建充值订单

`POST /v2/recharge/create-order`

**Body**：`{ "device_ids": [101, 102] }`

**Response** `data`：

```jsonc
{ "order": { "order_id": 9001, "device_count": 2, "total_price": 50 } }
```

### 8.3 充值记录

`POST /v2/device/recharge-records`

**Body**：`{ "device_id": 101 }`

**Response** `data`：

```jsonc
{
  "records": [
    { "order_id": 8001, "amount": 30, "status": "已完成", "created_at": "2026-08-18 14:38:01" },
  ],
}
```

---

## 接口清单速览

| #   | 接口               | 路径                                       |
| --- | ------------------ | ------------------------------------------ |
| 1   | 已连接设备列表     | `POST /v2/device/list-connected`           |
| 2   | 更新设备信息       | `POST /v2/device/update`                   |
| 3   | 设备群组列表       | `POST /v2/device/groups`                   |
| 4   | 设备加入群组       | `POST /v2/device/join-group`               |
| 5   | 设备退出群组       | `POST /v2/device/leave-group`              |
| 6   | 清空聊天记录       | `POST /v2/device/clear-messages`           |
| 7   | 设备联系人列表     | `POST /v2/device/contacts`                 |
| 8   | 添加设备联系人     | `POST /v2/device/add-contacts`             |
| 9   | 删除设备联系人     | `POST /v2/device/remove-contact`           |
| 10  | 更新联系人设置     | `POST /v2/device/update-contact-settings`  |
| 11  | 我创建的群组       | `POST /v2/group/my-created`                |
| 12  | 我加入的群组       | `POST /v2/group/my-joined`                 |
| 13  | 搜索群组           | `POST /v2/group/search`                    |
| 14  | 群组详情           | `POST /v2/group/info`                      |
| 15  | 群成员列表         | `POST /v2/group/members`                   |
| 16  | 添加群成员         | `POST /v2/group/add-members`               |
| 17  | 移除群成员         | `POST /v2/group/remove-member`             |
| 18  | 修改群信息         | `POST /v2/group/update`                    |
| 19  | 修改我的群昵称     | `POST /v2/group/update-my-nickname`        |
| 20  | 解散群组           | `POST /v2/group/dissolve`                  |
| 21  | 修改群设置         | `POST /v2/group/update-settings`           |
| 22  | 好友列表           | `POST /v2/friend/list`                     |
| 23  | 搜索用户           | `POST /v2/user/search`                     |
| 24  | 设备最新位置       | `POST /v2/device/location`                 |
| 25  | 设备某天轨迹       | `POST /v2/device/track`                    |
| 26  | 修改上报频率       | `POST /v2/device/update-track-setting`     |
| 27  | 紧急联系人列表     | `POST /v2/device/emergency-contacts`       |
| 28  | 添加好友紧急联系人 | `POST /v2/device/add-emergency-friends`    |
| 29  | 添加电话紧急联系人 | `POST /v2/device/add-emergency-phone`      |
| 30  | 删除紧急联系人     | `POST /v2/device/remove-emergency-contact` |
| 31  | 提醒列表           | `POST /v2/device/reminders`                |
| 32  | 创建提醒           | `POST /v2/device/create-reminder`          |
| 33  | 更新提醒           | `POST /v2/device/update-reminder`          |
| 34  | 删除提醒           | `POST /v2/device/remove-reminder`          |
| 35  | 可充值设备列表     | `POST /v2/device/recharge-list`            |
| 36  | 创建充值订单       | `POST /v2/recharge/create-order`           |
| 37  | 充值记录           | `POST /v2/device/recharge-records`         |
