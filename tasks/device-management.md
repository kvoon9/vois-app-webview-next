# 设备管理 WebView 页面

嵌入原生 App WebView 的设备管理系列页面。后端接口不存在，先用 Nitro mock server 支撑全部接口。

**范围纪律**：只做设备管理、设备的群组管理、群成员管理。截图里其他元素（添加智能设备、蓝牙设备、联系人管理、紧急联系人、流量卡充值、各类开关、群二维码、发起聊天/发送消息、举报、加好友、管理员开关、底部 tab/mic、A-Z 索引条）**一律不渲染**。

## Mock 层

- 新建 `apps/mock-server/`：Nitro 服务，端口 **3030**，内存状态 + 种子数据，忽略一切鉴权（appid/sign/token 不校验）
- website 的 dev/preview `/v2` 代理 target 改读环境变量：`VITE_API_TARGET`，缺省 `https://api.voischat.cn`；指向 `http://localhost:3030` 即走 mock。页面代码零感知
- 种子数据：2 台设备（一在线一离线）、3 个群（G1、test、茶花区）、成员覆盖 owner/admin/member 三种角色、至少一个群成员 > 5（触发群详情「+」号和完整列表页）、好友 10 个左右
- 写操作（加退群/增删成员/改名/改群信息）改内存，重启还原

## 接口契约

全部 POST，`/v2/` 前缀，snake_case 字段，响应信封 `{ errcode: 0, errmsg: '', data }`（与 `weilaFetch` 现有约定一致）。

### 设备

| 接口         | 路径                        | body                      | data                                                                                               |
| ------------ | --------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| 已连接设备   | `/v2/device/list-connected` | -                         | `{ devices: [{ user_id, user_num, nick, avatar, product, imei, version, activated_at, online }] }` |
| 设备改名     | `/v2/device/update`         | `{ device_id, nick }`     | `{}`                                                                                               |
| 设备的群列表 | `/v2/device/groups`         | `{ device_id }`           | `{ groups: [Group] }`                                                                              |
| 设备加群     | `/v2/device/join-group`     | `{ device_id, group_id }` | `{}`                                                                                               |
| 设备退群     | `/v2/device/leave-group`    | `{ device_id, group_id }` | `{}`                                                                                               |

### 群组

| 接口       | 路径                      | body                           | data                                                                                                      |
| ---------- | ------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 我创建的群 | `/v2/group/my-created`    | -                              | `{ groups: [Group] }`                                                                                     |
| 我加入的群 | `/v2/group/my-joined`     | -                              | `{ groups: [Group] }`                                                                                     |
| 群号搜索   | `/v2/group/search`        | `{ keyword }`                  | `{ groups: [Group] }`，群号 substring 匹配                                                                |
| 群信息     | `/v2/group/info`          | `{ group_id }`                 | `{ group: { group_id, num, name, intro, avatar, created_at, member_count } }`                             |
| 群成员     | `/v2/group/members`       | `{ group_id }`                 | `{ members: [{ user_id, user_num, nick, avatar, role, online, signature }] }`，role: `owner/admin/member` |
| 加成员     | `/v2/group/add-members`   | `{ group_id, member_ids: [] }` | `{}`                                                                                                      |
| 踢成员     | `/v2/group/remove-member` | `{ group_id, member_id }`      | `{}`                                                                                                      |
| 改群信息   | `/v2/group/update`        | `{ group_id, name?, intro? }`  | `{}`                                                                                                      |

### 好友

| 接口     | 路径              | body | data                                                         |
| -------- | ----------------- | ---- | ------------------------------------------------------------ |
| 好友列表 | `/v2/friend/list` | -    | `{ friends: [{ user_id, user_num, nick, avatar, online }] }` |

列表项 `Group` 统一为 `{ group_id, num, name, avatar }`。

头像编辑接口预留（`avatar` 字段入参 URL 字符串），**UI 本次不做**（头像铅笔不渲染）。

## 页面（全部嵌套路由，hash 路由）

| 路由                                                | 页面           | 要点                                                                                                                                                                                                                            |
| --------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/devices`                                          | 设备列表       | 在线绿卡+蓝角标 / 离线灰卡+灰角标；头像+名字+型号；空态「暂无已连接设备」；点击进详情                                                                                                                                           |
| `/devices/[id]`                                     | 设备详情       | 头像、名字（铅笔→BaseModal 改名）、激活时间、型号、设备号（带复制按钮，Clipboard API）、版本号、微喇号；唯一入口「群组管理」。数据源：接口 0 列表 `find(id)`，不加详情接口                                                      |
| `/devices/[id]/groups`                              | 群组管理       | 「从通讯录添加」「按条件查找添加」两个 link item + 已加入群列表                                                                                                                                                                 |
| `/devices/[id]/groups/add`                          | 从通讯录添加   | 「我创建的群聊」「我加入的群聊」两段；搜索框前端过滤；点击群 → BaseModal 确认「将 xx 加入群 yy?」→ 接口加群 → toast 返回。设备已在的群灰色禁选标「已加入」                                                                      |
| `/devices/[id]/groups/search`                       | 按条件查找添加 | 群号搜索（substring），结果行：头像+群名+群号，整行可点 → 确认弹窗 → 加群；空结果占位「未找到相关群组」。已加入的同样灰色禁选                                                                                                   |
| `/devices/[id]/groups/[groupId]`                    | 群详情         | 群名/头像/群号/创建时间；「群昵称」「群介绍」两个 link item 各自 BaseModal 编辑（接口 11）；群成员(N人) 行：前 5 头像 + 末尾「+」，箭头→成员列表、+ →添加成员；底部红色「退出群组」按钮（二次确认 → 退群 → 返回群组管理页刷新） |
| `/devices/[id]/groups/[groupId]/members`            | 群成员列表     | 搜索框前端过滤；群主/群管理员/成员三段分组；头像在线/离线角标；点击成员→成员详情                                                                                                                                                |
| `/devices/[id]/groups/[groupId]/members/add`        | 添加成员       | 「好友/设备」tab；候选 = 好友列表 + 设备列表，已在群的灰色禁选；全选（只选未禁用）；「确定」批量提交（接口 9）→ 返回群详情刷新成员                                                                                              |
| `/devices/[id]/groups/[groupId]/members/[memberId]` | 成员详情       | 头像/名字/号码/群昵称/签名；底部红色「移出群聊」（二次确认，群主不显示此按钮，mock 不做其他权限校验）→ 返回列表刷新                                                                                                             |

## 前端约定（必须遵守）

- `apps/website`，Vue 3 `<script setup>` + TS，`defineComponent` 不用裸 setup 对象；默认 `shallowRef`
- 数据获取一律 `@pinia/colada` `useQuery`/`useMutation`；请求函数写在 api 模块里，走 `weilaFetch`，snake_case DTO → camelCase 映射（参照 `src/utils/translation-api.ts` 的既有模式）
- i18n：所有文案进 `src/i18n/locales/{en,zh-CN,zh-TW}.json`，页面用 `t()`，不硬编码
- 新增 `useToast` composable（~30 行，固定定位 + 自动消失），操作成功反馈统一用它
- 加载/错误/空态复用 `src/components/settings/QueryState.vue`；页头复用 `PageHeader.vue`（返回用 `usePageBack`）；确认弹窗复用 `BaseModal.vue`
- 样式：UnoCSS，语义 token（`bg-surface`、`text-text-primary`、`card` 等，参照现有 settings 页面），用 space/flex 不用 gap/grid；整体视觉对齐 App 截图风格
- AGENTS.md 的其余规则（vueuse 优先等）全部适用

## 验证（开发者必须执行）

1. `vp check` + `vp test` 全绿
2. **agent-browser 走 Flow A 逐页面验证**：
   - 起 mock server（3030）+ `vp dev --host --port 3021`（website `.env.local` 配好 `VITE_API_TARGET=http://localhost:3030`，token 已有）
   - `agent-browser --session webview-debug open 'http://localhost:3021/#/devices'` 起，把 9 个页面全部点一遍：列表→详情→群组管理→两个添加入口（含确认弹窗、禁选态）→群详情（改名/改介绍/退群）→成员列表→添加成员（tab 切换、禁选、全选、批量提交）→成员详情（踢人）
   - 每个写操作后回到对应列表确认状态变化；截图留证

---

# 二期变更（2026-09-02 确认）

## 1. 群详情页重构（替代原"前 5 成员 + 跳转"设计）

单页结构：**顶部**群资料卡（头像/群名/群号/创建时间/群昵称/群介绍，昵称介绍仍可 BaseModal 编辑）→ **中间**完整群成员列表（不再截断前 5，列表上方有「添加成员」按钮，仍跳 members/add 页）→ **底部**红色「退出群组」+ 其下红色「解散群组」（仅群主可见，普通二次确认，解散后返回群组管理页）。

- **删除独立路由 `/devices/[id]/groups/[groupId]/members`**（完整列表并入详情页），members/add 和 members/[memberId] 保留
- 新接口 13：`POST /v2/group/dissolve` `{ group_id }` → `{}`
- 群详情补回 4 个开关（静音/共享我的位置/文字语音播报/置顶聊天），**真 mock**：接口 7 `group/info` 返回加 `settings: { muted, share_location, broadcast, pinned }`；新接口 18 `POST /v2/group/update-settings` `{ group_id, ...settings }` → `{}`

## 2. 联系人管理（设备详情新增「联系人管理」真实入口）

```
/devices/[id]/contacts                 两个添加入口 + 已添加联系人列表
/devices/[id]/contacts/add             从好友添加(已在联系人的灰色禁选,批量)
/devices/[id]/contacts/search          按微喇号 substring 搜索用户添加
/devices/[id]/contacts/[contactId]     联系人详情
```

新接口：

| 接口              | 路径                                 | body                                                                               | data                                                         |
| ----------------- | ------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 14 设备联系人列表 | `/v2/device/contacts`                | `{ device_id }`                                                                    | `{ contacts: [Friend + registered_at + settings + remark] }` |
| 15 添加联系人     | `/v2/device/add-contacts`            | `{ device_id, contact_ids: [] }`                                                   | `{}`                                                         |
| 16 删除联系人     | `/v2/device/remove-contact`          | `{ device_id, contact_id }`                                                        | `{}`                                                         |
| 17 搜索用户       | `/v2/user/search`                    | `{ keyword }`                                                                      | `{ users: [Friend] }`，微喇号 substring                      |
| 19 更新联系人设置 | `/v2/device/update-contact-settings` | `{ device_id, contact_id, muted?, share_location?, broadcast?, pinned?, remark? }` | `{}`                                                         |
| (假) 清除聊天记录 | `/v2/device/clear-messages`          | `{ device_id, contact_id }`                                                        | `{}`，直接成功                                               |

接口 12 `friend/list` 的 Friend 也补 `registered_at`。

**联系人详情页**（对齐 native 截图 screenshot_20260902_174713）：头像/名字/微喇号/注册日期/签名；4 个开关（真 mock，接口 19）；备注（真编辑，BaseModal + remark 字段）；清除聊天记录（假接口真 toast）；举报（跳现有 `report-user.vue`）；红色「删除联系人」（二次确认 → 接口 16 → 返回列表刷新）。**只缺「发起聊天」不渲染**。

## 3. 充值续费

- 设备详情：原「流量卡充值记录」行替换为「充值续费」link item → 点击弹确认窗（设备信息+金额）→ 创建订单 → toast「充值成功」
- 设备列表：顶部加「批量续费」link item → `/devices/recharge`：设备行（型号/名称/IMEI/卡 ICCID/卡到期时间/续费单价 + 勾选框）+ 底部全选/合计总价/提交 → 确认弹窗 → 创建订单 → toast「充值成功」。无订单详情页

新接口：

| 接口            | 路径                        | body                 | data                                                                       |
| --------------- | --------------------------- | -------------------- | -------------------------------------------------------------------------- |
| 20 续费设备列表 | `/v2/device/recharge-list`  | -                    | `{ devices: [{ user_id, nick, product, imei, iccid, expire_at, price }] }` |
| 21 创建充值订单 | `/v2/recharge/create-order` | `{ device_ids: [] }` | `{ order: { order_id, device_count, total_price } }`                       |

## 验收补充

- i18n 三语言、vp check/test、agent-browser Flow A 全页面验证（含二期新页面和群详情新结构）
- **上线前必须删除 `help.vue` 里的临时 `/devices` 入口链接**（代码里有 WARNING 注释）
- commit 按 Conventional Commits，不要 WIP 提交

## 二期补充：设备详情页充值区重构（2026-09-03 确认）

- 设备详情页新增**流量卡信息 card section**：卡 ICCID / 卡到期时间 / 续费单价（数据来自接口 20 recharge-list）；card 右上角放「充值缴费」按钮 → 仍走确认弹窗 → 创建订单 → toast「充值成功」
- card 下方加「流量卡充值记录」block link → 新页面 `/devices/[id]/recharge-records`
- 新接口 22：`POST /v2/device/recharge-records` `{ device_id }` → `{ records: [{ order_id, amount, status, created_at }] }`，种子数据每台设备 2-3 条
- 记录页就是简单列表：订单号/金额/状态/时间，沿用现有列表卡片样式

---

# 三期变更(2026-09-04 确认)

## 1. 群成员列表回退为独立页面(长列表考虑)

- 恢复 `/devices/[id]/groups/[groupId]/members` 独立页(群主/群管理员/成员三段分组 + 搜索框,同一期)
- 群详情页撤掉完整成员列表和「添加成员」按钮,**只保留一条 link item「群成员(N人) ›」**指向成员列表页;头像预览条也不要
- 「添加成员」入口改到**成员列表页顶部**,仍跳 members/add 页

## 2. 群管理功能补全

- **群名变更(仅群主)**:群详情「群名」link item,群主可点编辑(走现有 `/v2/group/update` name 字段),非群主纯展示不可点
- **群介绍**:同样仅群主可编辑
- **群昵称变更**(我的群内名片,任何人可改):新接口 26 `POST /v2/group/update-my-nickname` `{ group_id, nickname }` → `{}`;成员数据加 `nickname` 字段;群详情「群昵称」显示当前值,未设置显示「暂未设置」
- 群成员添加/删除、退群、解散:已存在,确保链路完整即可

## 3. 地图与轨迹(高德地图 + reka ui 日历)

三个新页面,入口 = 设备详情页三个 link item(位置和围栏 / 轨迹记录 / 轨迹上报设置):

| 路由                          | 页面         | 要点                                                                                                                                                                                                                                                        |
| ----------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/devices/[id]/location`      | 位置和围栏   | 高德地图:设备位置 marker + 围栏绿色圆圈(只读展示,mock 数据);`report_frequency === 'off'` 时顶部显示提示条「当前轨迹上报已关闭电子围栏无法生效,可点击修改轨迹上报频率」,点击跳轨迹上报设置;右侧「围栏」按钮不做,「共享」不做;截图 screenshot_20260904_103326 |
| `/devices/[id]/track`         | 轨迹记录     | 高德地图 + 右上角日历图标 → 日期选择弹窗(reka-ui Calendar + unocss,样式对齐截图 screenshot_20260904_103335:头部「选择日期」、月切换箭头、选中绿色圆点、底部取消/确定);确定后画当天轨迹 polyline;空数据 toast「当日无轨迹记录」                              |
| `/devices/[id]/track-setting` | 轨迹上报设置 | 单选列表:关闭/低频上报/中频上报/高频上报(截图 screenshot_20260904_103344,选中为绿色圆点);选中即调接口 25 持久化                                                                                                                                             |

新接口:

| 接口          | 路径                              | body                                         | data                                                                              |
| ------------- | --------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| 23 位置+围栏  | `/v2/device/location`             | `{ device_id }`                              | `{ lng, lat, updated_at, report_frequency, fence: { lng, lat, radius } \| null }` |
| 24 轨迹       | `/v2/device/track`                | `{ device_id, date }`(YYYY-MM-DD)            | `{ points: [{ lng, lat, time }] }`,空数组=无轨迹                                  |
| 25 改上报频率 | `/v2/device/update-track-setting` | `{ device_id, frequency }`(off/low/mid/high) | `{}`                                                                              |

mock 数据:设备 101 造**最近 3 天**轨迹(深圳坂田一带折线),围栏圆心+半径随便定;其他日期返回空。

## 高德接入(已确认)

- 加依赖 `@amap/amap-jsapi-loader`;加载模式参考 `~/weila/weila-work-webview/src/composables/useAMap.ts`(`window._AMapSecurityConfig` + `AMapLoader.load`,plugins: Scale、ToolBar)
- key 已配进 `apps/website/.env.local`:`VITE_AMAP_KEY` / `VITE_AMAP_SECURITY_CODE`(该文件 gitignored,不要把 key 写进源码)
- reka-ui 已是依赖,直接用

## 验收

- i18n 三语言、vp check + vp test 全绿、双构建通过
- agent-browser Flow A:成员列表独立页(从群详情 link item 进)、群名/群昵称/群介绍权限差异(群主 vs 非群主群)、三个地图页面渲染、日历选日期画轨迹、上报频率切换后位置页提示条联动

## 三期补充:设备群列表区分「我创建的/我加入的」(2026-09-04 确认)

- 接口 1 `/v2/device/groups` 的 group 项加 `created_by_me: boolean`(mock 按 `created_by === meId` 计算)
- 群组管理页 `/devices/[id]/groups` 的群列表改为两个 section:「我创建的」「我加入的」(参照从通讯录添加页的两段样式)

## 三期补充 2(2026-09-04 确认)

- Toast 位置太低:ToastHost 从底部 `bottom-4` 调整到页头下方的顶部区域
- 根路由 `/` 不再重定向到 `/help`,改为导航页:link item 列表,目前两项「帮助中心(/help)」「设备管理(/devices)」,沿用现有 link item 卡片样式

---

# 四期变更(2026-09-05 确认)

## 1. 设备资料页:位置共享开关 + 两个新入口

- 设备资料页「位置共享」switch 行(样式复用群详情开关),放在设备信息卡下方;mock: `Device` 加 `share_location` 种子字段,`device/update` 接受该字段,`list-connected` 一并返回
- 新增 2 个 link item:「紧急联系人」「提醒」,放在「联系人管理」之后

## 2. 紧急联系人(截图 screenshot_20260905_173157/173200/173203)

```
/devices/[id]/emergency-contacts           温馨提示 + 联系人行(红➖删除,BaseModal 确认)+ 添加好友 ➕ / 添加电话联系人 ➕
/devices/[id]/emergency-contacts/add-friend 选择页:复用 /v2/friend/list,已添加灰显,点行即加(toast+返回)
/devices/[id]/emergency-contacts/add-phone  电话+姓名+保存(必填+手机号基本校验)+ 底部提示句
```

新接口(设备维度,quota 由接口返回):

| 路径                                  | body                             | data                                                                                                                                                         |
| ------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/v2/device/emergency-contacts`       | `{ device_id }`                  | `{ contacts: [{ contact_id, type: 'friend'\|'phone', user_id?, user_num?, nick?, avatar?, name, phone }], quota: { friend_max, phone_max, sos_remaining } }` |
| `/v2/device/add-emergency-friends`    | `{ device_id, contact_ids: [] }` | `{}`,超上限 fail                                                                                                                                             |
| `/v2/device/add-emergency-phone`      | `{ device_id, name, phone }`     | `{}`,超上限 fail                                                                                                                                             |
| `/v2/device/remove-emergency-contact` | `{ device_id, contact_id }`      | `{}`                                                                                                                                                         |

## 3. 提醒(截图 screenshot_20260905_173217/173231)

```
/devices/[id]/reminders            卡片列表(大号时间/内容/重复文案)+ 绿色 FAB
/devices/[id]/reminders/[reminderId] 新建与编辑同一表单(reminderId 为 'new' 时新建):
                                   顶部原生 <input type="time">(点按弹系统时间选择器,不弹输入法);行:重复(once/daily/weekdays)、
                                   内容(BaseModal 文本)、响铃时长、重复响铃次数、重复响铃间隔(点行弹 BaseModal 单选列表,选中绿点,同 track-setting 样式);
                                   头部「确定」提交;编辑页另有红色「删除提醒」(BaseModal 确认)
```

字段取值(mock 校验 + UI 同一组常量,时间存 HH:mm):

- `repeat`: `once` / `daily` / `weekdays`
- `ring_duration`(秒): 30 / 60 / 120 / 180 / 300 / 600,默认 30
- `repeat_count`(次): 0 / 1 / 2 / 3 / 5 / 10,默认 3
- `repeat_interval`(分钟): 1 / 2 / 3 / 5 / 10,默认 5

| 路径                         | body                           | data                        |
| ---------------------------- | ------------------------------ | --------------------------- |
| `/v2/device/reminders`       | `{ device_id }`                | `{ reminders: [Reminder] }` |
| `/v2/device/create-reminder` | `{ device_id, ...Reminder }`   | `{ reminder_id }`           |
| `/v2/device/update-reminder` | `{ reminder_id, ...Reminder }` | `{}`                        |
| `/v2/device/remove-reminder` | `{ reminder_id }`              | `{}`                        |

种子数据:设备 101 一条好友紧急联系人、一条提醒 `17:32 / 123 / 只响一次 / 30秒 / 3次 / 5分钟`。

## 四期验收

- i18n 三语言、`vp check` + `vp test` 全绿
- agent-browser Flow A:设备资料开关与两个新入口、紧急联系人三页全链路(添加/删除/上限灰显)、提醒列表+新建+编辑+删除、各字段 Select 取值
