---
description: '安卓 App 设备管理功能在 H5 端复刻的可行性结论：哪些直接能做、哪些要 App 或后端配合、哪些不做；以及移除 mock server 的动作清单。'
---

# 设备管理复刻可行性

> 2026-10-15。材料有三份：安卓 APK 反编译源码（`vender/WL_V5.0.4_Code504_09181532.apk`，jadx 输出在本机 `/tmp/vois-apk/wl-src`）、Apipost 导出的真实接口文档（`api-reference/`，44 个 `/v2/subuser` 接口）、website 现状代码。本文是动手前的结论。2026-10-15 更新：Phase 0（删 mock）与 Phase 1（页面接真实 API）已落地，实时定位按轮询桥方案实现（见 `docs/native/android/v5.0.8+508/location-bridge.md`）；后端补接口项 A1-A11 待排期。
>
> 同日补充：v5.0.8 包（`WL_V5.0.8_Code508_10151723.apk`）逆向完成后，第 2 节的实时位置按实际落地的桥实现更新。
>
> **2026-10-20 状态**：本文之后已落地的事项——真实 API 迁移（mock server 已删除，联系人 / 紧急联系人 / 位置轨迹 / 充值 / 群详情全部走 `/v2/subuser/*`）、围栏增删改（含围栏中心逆地理与半径步进）、提醒重复规则（自定义星期与每月档）、native UI/UX 对齐（`docs/uiux-alignment-plan.md` 的 blocking 项已全部处理）、weila-mcp 同步（调试服务器已对齐当前接口契约）。正文保留当时的可行性判断记录；其中「在调 mock」「待排期」「待做」一类**现状**描述是 2026-10-15 的快照，不再是当前事实。当前状态见 `docs/device-management-status.md`。

## 总结论

**移除 mock server：可以直接做，没有阻碍。** website 的开发代理默认就指向真实后端 `api.voischat.cn`，`~/.vois/.env` 里没配过 mock 地址，CI 和测试也不依赖 mock 进程。要改的东西很少，清单在文末。唯一要注意：还有 8 个页面的接口停在 mock 上（联系人、紧急联系人、位置轨迹、充值、群详情），删 mock 的同时得把它们换到真实接口，不然这些页面直接 404。

**复刻安卓设备管理：大部分能做。** 安卓那套设备管理逐页盘了一遍，功能点分四类：

- 14 个现有接口就够，直接做（设备资料、轨迹、围栏、省电档、紧急联系人、提醒、好友、群组，加上充值的列表、记录、建单）；
- 实时位置：手机自身定位走 5.0.8 新增的轮询桥，已落地（第 2 节）；设备自己的实时位置仍先做「最近位置」降级版；
- 7 个要等后端补接口（群资料、会话设置、清空聊天、锁定、关机、音量、按键联系人），都是同一类活，见第 3 节；支付收尾也差后端一个字段；
- 5 类不做（蓝牙、手麦、对讲这些），理由见第 4 节。

## 为什么有的功能做不了

先讲清楚安卓 App 里设备管理是怎么实现的，这决定了哪些能搬到 H5。

安卓走两条通道。一条是私有 TCP 长连接（protobuf）：绑定设备、锁定、远程关机、改设备配置（围栏、省电档、位置共享开关、紧急联系人、按键联系人、音量）、实时位置、设备的好友和群操作，全走这条。另一条是普通 HTTP：设备信息、轨迹、SOS 次数、提醒、SIM 卡充值，走这条。

问题是 H5 接不了那条 TCP 长连接。好在后端已经把大部分管理操作 HTTP 化了——就是 `api-reference` 里那 44 个 `/v2/subuser` 接口，本质上是把 socket 通道里管理员会用到的操作包装成 HTTP 给管理页面用。所以围栏、省电档、紧急联系人这些在安卓里走 socket 的功能，H5 反而能直接做。没包进来的部分（锁定、关机、音量、按键联系人、群会话设置），就是第 3 节要请后端补的。

另外两个对复刻有利的事实：

1. 安卓 App 里有个 `HardwareWebActivity`，专门加载服务端下发的 H5 菜单（设备配置里的 `web.name` / `web.url`，POST 换取最终地址后开 WebView）。也就是说官方本来就打算把一部分设备管理做成 H5。APK 里还留着一个调试地址 `http://192.168.1.87:5173/#/devices/groups?hardware-id=…`，路由形态就是本仓库这个项目。
2. `user_id` 就是设备。这套 API 没有单独的 device_id，`manager-get-all-device` 返回的 `user_id` 就是后续所有设备操作的标识。

## 1. 能直接做的（14 个）

| 功能 | 接口 | H5 现状 |
| --- | --- | --- |
| 设备列表 | `manager-get-all-device` | `devices/index.vue` 已接 |
| 设备详情 | `device-get-detail` | `[id].vue` 用列表数据拼的，换成这个接口 |
| 改昵称 / 改头像 | `device-change-nick`、`device-change-avatar` | `[id].vue` 还在调 mock 的 `/v2/device/update` |
| 位置共享开关 | `device-change-location-share` | 同上 |
| 解绑设备 | `device-unbind` | 新增页面。注意返回值是「解绑后剩余好友列表」，按解绑成功处理就行 |
| 轨迹回放 | `track-get` | `track.vue` 在调 mock；地图用现成的 `useAMap` |
| 轨迹上报模式（省电档） | `track-get-mode`、`track-set-mode` | `track-setting.vue` 在调 mock。档位枚举 0 关 / 1 低 / 2 中 / 3 高，和安卓一致 |
| 电子围栏 | `geofence-set`、`geofence-get`、`geofence-delete` | 已实现完整交互（2026-10-20）：地图选点、半径 200–1000 米步进 50、命名、删除。一个设备只有一个围栏 |
| 紧急联系人（SOS） | `emergency-contact-get`、`-add-friend`、`-add-phone`、`-delete` | 3 个页面在调 mock。配额和剩余次数（`sos_friend_limit`、`sos_phone_limit`、`sos_times`）都在 get 的返回里，安卓要单独调 v1 拿的 SOS 次数也省了 |
| 提醒 | `reminder-add`、`-change`、`-delete`、`-get`、`-get-all` | 已在用真实的 `/v2/ext/rmdr/*`（安卓同一套），可以先不迁，也可以顺手换成实名版 |
| 设备好友 | `friend-get-all`、`-search-user`、`-invite`、`-delete`、`-change-remark` | `contacts/` 下 4 个页面在调 mock，重写成 friend 系列 |
| 设备群组 | 13 个 `group-*` | 大半已接；`[groupId].vue` 里还混着 3 个 mock 调用 |
| 充值列表 / 记录 / 建单 | `simcard-get-all-need-renew`、`-get-all-renew-order`、`-create-renew-order` | 2 个页面在调 mock。建单参数 `iccid` + `pay_method` + `pkg_name`，后两个原生 page-params 已经发下来了（`wxpay-appid`、`pay-method`、`pkg-name`）。支付怎么收尾见下一节 |

## 2. 需要 App 配合的（2 个）

### 微信支付：桥已经做好了，就差后端一个字段

调研里发现的好消息：安卓 App 的桥协议里已经有支付了。v5.0.4 APK 实现了 `wechat-app-prepay`（`WechatPayHelper.java`）：H5 把微信支付参数传给 App，App 组装 `PayReq` 拉起微信，付完把 `{wxpaycode, prepayId}` 回调给 H5。实名认证项目（weila-webview-realname-auth）已经在线上用过这套，双端验证过。

iOS 走内购（`ios-app-prepay`），而 v2 建单接口的返回字段（`amount` 分、`currency`、`order_no`、`product_id`、`product_name`、`product_desc`）和 iOS 桥需要的参数一一对应，像是专门对齐过的，回归一次就能用。

现在唯一卡住的：`simcard-create-renew-order` 在 `pay_method=wechat` 时不返回微信支付参数（旧 v1 接口返回过 `order.payreq`）。后端把 pay 参数加进响应（第 3 节 A1），支付就通了。等接口期间先上线「选卡建单 + 提示去 App 支付」。

### 实时位置：桥已随 5.0.8 落地，H5 轮询手机 GPS

调研时设想的是事件推送（`subscribe-device-location` / `device-location` 事件 / `bridge.on` 那套），最终落地的不是它。安卓 v5.0.8（`WL_V5.0.8_Code508_10151723.apk`）在 `VoisWebActivity` 里注册了 `WebLocationBridge`，给 H5 的是一对请求/应答类型，仍然没有事件通道：

- `start-location {interval, time}` 开一个有界的定位会话，毫秒单位，interval 下限 5000，time 钳制在 15000-60000，应答回显钳制后的值。没有 stop 协议，会话到点自动停；
- `get-location {}` 返回会话内最后一次定位；没 start 或已到期返回 -1；
- 循环完全在 H5 侧：`useRealtimeLocation` 起轮询，默认 30 秒窗口、到期前再发一次 start 续期，页面隐藏即暂停。权限弹窗、退后台暂停定位、销毁清理都在原生侧处理。

注意语义：桥给的是**手机自身的 GPS**（`LocationImpl` 到高德定位栈，`coordType` 返回 gcj02），不是子设备的位置，它服务的是位置页里的「我的实时位置」。设备自己的实时位置仍是「最近位置」降级方案：围栏（`geofence-get`）加当天轨迹最后一个点（`track-get`），后端 A5（最近位置快照）到位后连轨迹都不用依赖。

协议细节、行为规则和证据见 `docs/native/android/v5.0.8+508/location-bridge.md`。

## 3. 要等后端补接口的（7 个功能，11 项改动）

这些都是同一类活：把安卓 socket 上的操作包装成 HTTP，模式和现有 44 个接口一致（query 四参数鉴权、errcode 信封）。按优先级排：

| # | 接口 | 请求 | 返回 | 说明 | 优先级 |
| --- | --- | --- | --- | --- | --- |
| A1 | `simcard-create-renew-order` 响应加字段 | 不变 | wechat 时多返回 `pay: {appid, partnerid, prepay_id, noncestr, timestamp, sign}` | 对齐 v1 的 payreq 和桥的 WechatPrepay 类型，支付收尾就差这个 | P0 |
| A2 | `device-get-detail` 响应加字段 | 不变 | 多返回 `capabilities`（安卓设备配置 readonly 里的管理子集：`location_support`、`reminder_support`、`emergency_forbid`、`monitor_support`、`volume_max`、`battery`、`button_define`、`web`） | 安卓靠这些字段决定菜单显隐，H5 现在只能猜 | P1 |
| A3 | 新增 `group-get` | `user_id`、`group_id` | 群对象（含 `intro`、`created_at`、`member_count`、`my_remark`） | 群资料页完整化；现在 mock 的 `/v2/group/info` 没有真实等价 | P1 |
| A4 | 新增 `group-change-intro`（或给 `group-change-name` 加可选 `intro`） | `user_id`、`group_id`、`intro` | 无 | 同上 | P1 |
| A5 | 新增 `device-realtime-location` | `user_id` | `location: {lat, lng, radius, type, ts}`（服务端缓存 socket 最近一帧） | 「最近位置」不用依赖当天轨迹 | P2 |
| A6 | 新增 `group-update-settings` 和 `contact-update-settings` | `user_id`、`group_id` 或 `contact_id`、可选 `muted`、`pinned`、`broadcast`、`share_location` | 无 | 免打扰、置顶这些会话设置；安卓走 socket 会话属性 | P2 |
| A7 | 新增 `device-clear-messages` | `user_id`、`contact_id` 或 `group_id` | 无 | 清空聊天记录 | P2 |
| A8 | 新增 `device-lock`、`device-unlock` | `user_id` | 无 | 从设备锁定、解锁 | P2 |
| A9 | 新增 `device-shutdown` | `user_id` | 受理结果 | 远程关机。安卓靠设备回执确认，HTTP 建议先返回受理，最终状态轮询 `device-get-detail.online` | P2 |
| A10 | 新增 `device-adjust-volume` | `user_id`、`direction`（raise 或 lower） | 可选返回当前音量 | 音量加减 | P3 |
| A11 | 新增 `button-contact-get`、`button-contact-set` | get 传 `user_id`；set 传 `user_id` 和 `buttons` 数组 | get 返回 `define`（按键定义）和 `buttons` | 物理按键绑定联系人，依赖 A2 下发按键定义 | P3 |

另有一个备选：`device-bind`（配对码绑定）。默认不提，理由见下节。

## 4. 不做的（5 类）

- **BLE 蓝牙设备全套**（扫描、连接、校验、详情、历史、快捷会话绑定）：WebView 里没有蓝牙能力，扫描、GATT、自动重连、本地绑定库全在原生域，原生 UI 也是现成的。搬进桥协议没有任何增益。
- **WL100 蓝牙手麦**：经典蓝牙 SPP，设置存在手机本地，不过服务端，H5 做了也没意义。
- **监听和对讲**：前台服务加音频加 PTT 协议栈，不是管理页面该碰的。
- **设备事件推送**（绑定、锁定这些通知）：管理页面刷新或重进就能拿到最新状态，专门做一条 App 到 H5 的广播通道，成本大于收益。实时位置最终落地的是 H5 轮询而不是推送（第 2 节），这条通道更没有理由做了。
- **绑定设备**（扫码、配对码）：入口在原生的相机和键盘流程里，绑定完还要按设备类型分流跳页面，整个链路都在原生导航域。产品上「绑定」这个动作就发生在 App 里，H5 没有入口场景。哪天要做网页管理后台了再评估 `device-bind`。

## 5. 删 mock 的动作清单

| 动作 | 位置 |
| --- | --- |
| 删掉 `apps/mock-server/` 整个目录，重跑 `vp install` 更新 lockfile | `apps/mock-server/`、`pnpm-lock.yaml` |
| 两段代理合成一条 `/v2` 指向真实后端，删掉「Group management went real first…」那句过时注释 | `apps/website/vite.config.ts` 30–32、54–63、67–76 行附近 |
| 同步删掉两个 target 变量的说明 | `apps/website/.env.example` |
| 清理文档：AGENTS.md 里的 mock 后端提法、verify skill 的 Mode M 整节、各 feature 文档里的 mock 段落 | `AGENTS.md`、`.pi/skills/verify-vois-webview/` |
| 历史文档标注已过时（可选） | `docs/api/device-management-api-requirements.md` |

## 6. 其他注意点

- 提醒的 `delete-reminder` 有历史 bug（返回成功但不生效，`docs/api/device-management-api-requirements.md` 4.1 节记录过），迁移到 `reminder-delete` 后要回归；还不行就前端先过滤。
- 轨迹点带坐标系字段 `type`（0 是 gcj02，1 是 wgs84），画图前要判断，别混用。
- 提醒的重复类型比现在 UI 的三档多一个「每月」（`repeated_type` 0 单次 / 1 每天 / 2 每周 / 3 每月），迁移时可以顺手支持。
- 围栏必填 `name`；一个设备只有一个围栏，交互对齐安卓：没有就创建，有了可改可删。
- 群审核两个接口的字段以 `_raw.json` 为准（md 表格有漏列和误抄）：`group-get-all-join-audit` 请求只有 `user_id`；审核 `status` 0 未处理 / 1 同意 / 2 拒绝。

## 7. 建议的顺序

1. 删 mock（上面第 5 节的清单，半天）。
2. 存量页面换真实接口：`[id].vue`、充值两页、联系人四页、紧急联系人三页、位置轨迹三页、群详情去 mock。这一步不依赖任何新增接口，支付先接桥、A1 没好就提示去 App 付。
3. 新增能力：围栏编辑、解绑入口、提醒「每月」档、`[id].vue` 菜单入口恢复——均已落地（见 `docs/device-management-status.md`）；A2、A5 仍未交付，能力显隐和「最近位置」继续等后端。
4. 联动项：A1 好了支付收尾；实时位置轮询桥已随安卓 5.0.8 落地（第 2 节）；A6 往后的接口随后端节奏。
5. 验收：ego-browser 全流程过一遍，verify skill 的 feature 文档同步更新，iOS 内购回归一次。

## 材料在哪

三份调研底稿在本机 `/tmp/vois-apk/reports/` 下（安卓逆向逐文件行号、44 个接口全字段、website 逐函数盘点），需要的话归档进 `docs/`。反编译源码在 `/tmp/vois-apk/wl-src/`。
