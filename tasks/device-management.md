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
