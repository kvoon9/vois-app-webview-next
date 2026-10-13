# 设备管理：后端 v2 API 需求

> 整理时间：2026-10-13
> 依据：真实后端探测（调试账号 1541034，名下设备 1848581）+ Apipost 文档《微喇内部WEB接口 / main》（`docs.apipost.net`，共 298 个接口）
> 约束：H5 只能调用 `/v2`，并沿用现有 web 签名（query `appid` / `et` / `sign` / `token`）。**不能用 `/v1`**——那套是原生签名：`?access-token=` + body `{app_id, et, sign}`。

## 1. 背景

设备管理系列页面（设备资料、联系人管理、紧急联系人、提醒、位置和围栏、轨迹记录、轨迹上报设置、充值续费）已实现 UI，数据使用 Nitro mock 假数据。接真实后端时只打通了「设备列表」和「群组管理」，其余入口在前端隐藏。

本次已把**设备提醒**和**流量卡信息**接到真实 v2 接口并验证通过（第 2 节）。剩下的功能需要后端按本文补齐 v2 接口，前端把入口重新放出即可——页面代码全部在仓库里，见第 5 节。

## 2. 已接入并验证通过（对照用，无需新增）

| 功能                                     | 接口                                                                                             | 备注                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 设备列表                                 | `POST /v2/subuser/manager-get-all-device`                                                        | `devices[]` 里已包含 `sim_card{iccid,expiry_date,recharge}` 和 `location_share`，前端本次才用上 |
| 设备群组 / 群成员 / 群名 / 群头像 / 群主 | `POST /v2/subuser/*`                                                                             | 已上线                                                                                          |
| 提醒 CRUD                                | `POST /v2/ext/rmdr/{get-all-reminder,get-reminder,add-reminder,change-reminder,delete-reminder}` | 本次接入；**delete 不生效，见 4.1**                                                             |
| 卡信息                                   | `POST /v2/ext/get-simcard-info` `{imsi}`                                                         | 已验证可用                                                                                      |
| 固件版本                                 | `POST /v2/appupgrade/client/check-version`                                                       | 已验证可用                                                                                      |
| 逆地理编码                               | `POST /v2/loc/regeo`                                                                             | 已验证可用                                                                                      |

## 3. 需要新增的 v2 接口

统一约定：

- `/v2/` 前缀、`POST`、现有 web 签名；
- 设备一律用 `user_id` 表示（与 `manager-get-all-device` 返回的 `user_id` 相同，即子账号 ID）；
- 响应信封 `{ errcode, errmsg, data }`；
- 字段 snake_case。

### 3.1 设备改名（P0，线上入口已在但报 404）

- 现状：设备资料页「重命名」调用 `POST /v2/device/update`，真实后端 **HTTP 404**。这个入口是线上唯一可见、且当前坏掉的功能。
- 建议：

```http
POST /v2/ext/update-device
{ "user_id": 1848581, "nick": "新名字" }
```

```json
{ "errcode": 0, "errmsg": "请求成功", "data": {} }
```

### 3.2 设备联系人管理

页面：`/devices/:id/contacts`（列表 / 添加 / 按微喇号搜索 / 详情），每个联系人带 4 个开关（静音、共享我的位置、文字语音播报、置顶聊天）、备注、清空聊天记录。

原生 App 这部分走 TCP protobuf（`setExtensionConfig` 的 `buttons`、会话设置），H5 访问不了，需要 HTTP 化。

| 用途           | 建议接口                               | body                                                                             | data                                                                                                                                                    |
| -------------- | -------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 联系人列表     | `POST /v2/ext/device-contacts`         | `{ user_id }`                                                                    | `{ contacts: [{ user_id, user_num, nick, avatar, online, registered_at, signature, remark, settings: { muted, share_location, broadcast, pinned } }] }` |
| 添加联系人     | `POST /v2/ext/add-device-contacts`     | `{ user_id, contact_ids: [] }`                                                   | `{}`                                                                                                                                                    |
| 删除联系人     | `POST /v2/ext/remove-device-contact`   | `{ user_id, contact_id }`                                                        | `{}`                                                                                                                                                    |
| 更新联系人设置 | `POST /v2/ext/update-contact-settings` | `{ user_id, contact_id, muted?, share_location?, broadcast?, pinned?, remark? }` | `{}`                                                                                                                                                    |
| 搜索用户       | `POST /v2/user/search`                 | `{ keyword }`                                                                    | `{ users: [{ user_id, user_num, nick, avatar }] }`，微喇号 substring                                                                                    |
| 清空聊天记录   | `POST /v2/ext/clear-messages`          | `{ user_id, contact_id }`                                                        | `{}`                                                                                                                                                    |

### 3.3 紧急联系人

页面：`/devices/:id/emergency-contacts`（列表 + 添加上限提示 + 好友/电话两种入口）。

| 用途        | 建议接口                                | body                           | data                                                                                                                                                         |
| ----------- | --------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 列表 + 配额 | `POST /v2/ext/emergency-contacts`       | `{ user_id }`                  | `{ contacts: [{ contact_id, type: "friend"｜"phone", user_id?, user_num?, nick?, avatar?, name, phone }], quota: { friend_max, phone_max, sos_remaining } }` |
| 添加好友    | `POST /v2/ext/add-emergency-friends`    | `{ user_id, contact_ids: [] }` | `{}`，超上限返回业务错误                                                                                                                                     |
| 添加电话    | `POST /v2/ext/add-emergency-phone`      | `{ user_id, name, phone }`     | `{}`，超上限返回业务错误                                                                                                                                     |
| 删除        | `POST /v2/ext/remove-emergency-contact` | `{ user_id, contact_id }`      | `{}`                                                                                                                                                         |

说明：SOS 剩余次数目前只有 `/v1/subusers/get-sos-times`（v1 不可用）。最好并入上面的 `quota.sos_remaining`。

### 3.4 位置和围栏

页面：`/devices/:id/location`（高德地图上展示设备位置 + 电子围栏圆圈）。

```http
POST /v2/ext/device-location
{ "user_id": 1848581 }
```

```json
{
  "errcode": 0,
  "errmsg": "请求成功",
  "data": {
    "lng": 114.06565,
    "lat": 22.67116,
    "updated_at": "2026-10-13 11:20:00",
    "report_frequency": "mid",
    "fence": { "lng": 114.06565, "lat": 22.67116, "radius": 500 }
  }
}
```

`report_frequency` 取值 `off | low | mid | high`；无围栏时 `fence` 为 `null`。原生走 TCP 定位推送，需要服务端转成 HTTP。

### 3.5 轨迹记录

页面：`/devices/:id/track`（选日期 → 地图画 polyline）。

```http
POST /v2/ext/device-track
{ "user_id": 1848581, "date": "2026-10-12" }
```

```json
{
  "errcode": 0,
  "errmsg": "请求成功",
  "data": { "points": [{ "lng": 114.0656, "lat": 22.6711, "time": "2026-10-12 08:31:05" }] }
}
```

参考：企业版已有 `POST /v2/corp/loc/get-track`（`{user_id,date}` → `{count, tracks:[{created,lat,lng}]}`），个人账号调用返回 `45003 您不是企业创建者`。建议按个人设备维度开放同等能力，**字段名与 corp 对齐**更好（`tracks[]` + `created`）。另存在 `/v1/subusers/get-track`，v1 不可用。

### 3.6 轨迹上报设置

页面：`/devices/:id/track-setting`（关闭 / 低频 / 中频 / 高频）。

```http
POST /v2/ext/update-track-setting
{ "user_id": 1848581, "frequency": "mid" }
```

```json
{ "errcode": 0, "errmsg": "请求成功", "data": {} }
```

原生对应 TCP 的 `location_mode`。

### 3.7 群资料 / 群设置

现状：群详情页的「群介绍」「创建时间」和 4 个开关（消息免打扰、共享我的位置、文字和语音播报、置顶聊天）在前端用 `v-show="false"` 隐藏，因为 `/v2/group/info`、`/v2/group/update-settings` 都 404。

| 用途        | 建议接口                                 | body                                                                  | data                                                                                                                                                        |
| ----------- | ---------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 群资料      | `POST /v2/subuser/group-get`             | `{ user_id, group_id }`                                               | `{ group: { group_id, num, name, avatar, intro, created_at, member_count, is_creator, is_admin, settings: { muted, share_location, broadcast, pinned } } }` |
| 改群名/介绍 | `POST /v2/subuser/group-update`          | `{ user_id, group_id, name?, intro? }`                                | `{}`（群名已有 `group-change-name`，可只补 `intro`）                                                                                                        |
| 改群设置    | `POST /v2/subuser/group-update-settings` | `{ user_id, group_id, muted?, share_location?, broadcast?, pinned? }` | `{}`                                                                                                                                                        |

### 3.8 充值续费

现状：

- `/v2/ext/renew-simcard {imsi}` 只返回微信 **Native** 支付链接 `code_url`（`weixin://wxpay/...`），H5 页面打不开；
- 充值记录只有 mock 的 `/v2/device/recharge-records`，不存在；
- `/v1/simcard/app/get-orders`、`/v1/simcard/app/renew` 属 v1，不可用。

需要：

1. 充值记录

```http
POST /v2/ext/recharge-records
{ "user_id": 1848581 }
```

```json
{
  "errcode": 0,
  "errmsg": "请求成功",
  "data": {
    "records": [
      { "order_id": 123, "amount": 30, "status": "paid", "created_at": "2026-09-01 10:00:00" }
    ]
  }
}
```

2. 支付方式二选一（需要产品确认）：

   - a) 返回可交给原生 App 拉起微信支付的参数（bridge 调用）；
   - b) 保持 `code_url`，另提供订单状态查询接口，H5 自己渲染二维码让用户扫码。

3. 续费列表（原 mock 的 `/v2/device/recharge-list`）：设备单价、卡到期时间。建议并入 `manager-get-all-device`（补 `price` 等字段）或新增 `/v2/ext/recharge-list`。

## 4. 已发现的后端问题（需要后端确认）

### 4.1 `delete-reminder` 返回成功但不生效（阻塞提醒上线）

复现（调试账号，`user_id=1848581`）：

```http
POST /v2/ext/rmdr/add-reminder
{ "user_id": 1848581, "name": "__probe__", "repeated_type": 0, "repeated": [], "duration": 60, "again_interval": 300, "again_times": 3, "reminder": "23:59" }
→ { "errcode": 0 }，随后 get-all-reminder 能查到 id=116
```

```http
POST /v2/ext/rmdr/delete-reminder
{ "user_id": 1848581, "reminder_ids": [116] }
→ { "errcode": 0, "errmsg": "请求成功" }
```

之后 `get-all-reminder` 与 `get-reminder {reminder_id:116}` 仍然返回该条（等待 20s 后依旧）。已尝试 `reminder_ids`（数字/字符串）、`reminder_id`、`id`、带/不带 `user_id`、账号 ID 等组合，均为 errcode 0 或 20，数据不删。前端已经按文档契约接上，等后端修复后即可生效。

> 注意：验证过程中在设备 1848581 上留下了两条测试提醒（`__probe__`、`起床吃药`），已改成「只响一次 + 00:01」避免打扰；修复删除接口后可以直接删掉。

### 4.2 `repeated` 取值文档与实际不一致

- 文档「获取所有提醒」响应示例是 `[0,1,2,3,4,5,6]`，「添加提醒」请求示例是 `[1,2,3,4,5,6,7]`；
- 实际后端存储/返回的是 `[1..7]`（周一=1 … 周日=7），`repeated_type` 为 `0=once / 1=daily / 2=自定义`。

请后端在文档里统一为 1–7；前端目前按 1–7 处理，并在 `repeated_type` 缺失时用日期数组兜底。

### 4.3 `get-simcard-info` 的入参与设备列表不一致

`/v2/ext/get-simcard-info` 需要 `imsi`，但 `manager-get-all-device` 只返回 `sim_card.iccid`（ICCID），拿不到 IMSI。请确认该接口是否接受 `iccid`，或在设备列表里补 `imsi`。

### 4.4 `/v2/ext/rmdr/*` 对非设备 user_id 静默成功

对账号自身 ID 调 `add-reminder` 返回 `errcode: 0`，但 `get-all-reminder` 查不到（不落库）。建议返回明确错误（如「该用户不是设备」），否则调用方无法判断。

## 5. 前端已就绪的页面（接口到位后只需放开入口）

| 功能                         | 页面文件（`apps/website/src/pages/`）                              | 当前状态                         |
| ---------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| 联系人管理                   | `devices/[id]/contacts/{index,add,search,[contactId]}.vue`         | 页面完整，入口隐藏               |
| 紧急联系人                   | `devices/[id]/emergency-contacts/{index,add-friend,add-phone}.vue` | 同上                             |
| 提醒                         | `devices/[id]/reminders/{index,[reminderId]}.vue`                  | **已接入正式接口，入口已放出**   |
| 位置和围栏 / 轨迹 / 上报设置 | `devices/[id]/{location,track,track-setting}.vue`                  | 页面完整，入口隐藏               |
| 充值续费                     | `devices/recharge.vue`、`devices/[id]/recharge-records.vue`        | 页面完整，入口隐藏               |
| 群资料 / 群设置              | `devices/[id]/groups/[groupId].vue` 内 `v-show="false"`            | 字段已在，取消隐藏即可           |
| 流量卡信息                   | `devices/[id].vue` 卡片                                            | **已接入，设备有 SIM 卡时展示**  |
| 设备改名                     | `devices/[id].vue` 铅笔按钮                                        | 线上入口已在，接口 404（见 3.1） |

接口就绪后，前端每项工作量为「换 API 路径 + 字段映射 + 放开入口 + 回归验证」，1–2 天可全部完成。
