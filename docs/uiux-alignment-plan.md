# 设备管理页 UI/UX 对齐清单（原生 v5.0.8 → Vue H5）

- 只读审查，未修改任何源码；本文件为唯一新增文件。
- 原生证据根：`/tmp/vois-apk/wl508/`（`sources/com/voistech/chat/ui/activity/hardware/`、`resources/res/layout/`、`values/strings.xml`、`values/colors.xml`）；H5 根：`/Users/kvoon/weila/vois-app-webview-next-uiux-align/apps/website/src/`。
- 分级：**blocking** = 首屏可见的结构/文案/权限/交互不一致；**minor** = 状态或细节；**needs-media** = 需录屏判断；**设计系统差异 — 保留 H5** = 原生 0.5/2dp 分隔线、描边、勾选图标等与 H5 无边框规范冲突，不在 H5 复刻。
- H5 设计基准：`apps/website/uno.config.ts:114-154`（page/panel/nav-item/card/btn/fab/radio/row-chevron）与 `src/styles/base.css:2-19`。
- 颜色：原生 `window_bg #f9fafb`、`card_bg #ffffff`、`primary_text #000000`（colors.xml:34,414,445）与 H5 `base.css:9-19` 基本一致；原生 `green_primary #00bb90`（colors.xml:148）vs H5 `primary #54b893`（base.css:2）→ **设计系统差异 — 保留 H5**。
- 原生 `SettingsItem` 行：最小 48dp、上下 14dp、左右 26dp、标题 16sp（`layout/ui_settings_item.xml:5-11,23-31`）；H5 `nav-item` 最小 48px、`px-4`、16px（uno.config.ts:119-123）→ 行高接近，细节按 H5。

## 1. 设备列表（SubHardwareListActivity → pages/devices/index.vue + DeviceListItem.vue）

| element | native evidence | current H5 | delta | action |
|---|---|---|---|---|
| 页面标题 | `SubHardwareListActivity.java:28` `tv_device`=设备 | `devices/index.vue:25` `device.title` | 一致 | 无 |
| 行副标题 | `adapter/SubHardwareListAdapter.java:69` 群组数 `群组 %1$s / %2$s` | `DeviceListItem.vue:37-43` 型号·IMEI 或微喇号 | **blocking** 首屏文案不同 | 改为群组数（需 API groupCount/limit），或产品确认口径 |
| 行间距/内边距 | `item_sub_hardware_list.xml:6-14` 内 14dp、外 16dp、下 8dp；`activity_sub_hardware_list.xml:16-17` 列表 8dp | `devices/index.vue:27,35` `p-4`+`space-y-3`；`card` p-4 | minor / needs-media 视觉节奏 | 录屏核对 |
| 头像 | `item_sub_hardware_list.xml:17-18` 48dp | `Avatar.vue:28` md=44px | minor 尺寸 | 可改 48 或保留 token |
| 在线点/箭头 | 原生无 | `DeviceListItem.vue:34,45` status-dot + row-chevron | 设计系统差异 — 保留 H5（H5 多显示在线态） | 保留 |
| 空/错误态 | `SubHardwareListActivity.java:56-73` 无空态，仅 toast | `devices/index.vue:33` “暂无已连接设备” | minor H5 更完整 | 保留 |
| 点击热区 | adapter 整行 `onItemClick`（`SubHardwareListAdapter.java:26-71`） | `DeviceListItem.vue:29-45` 外层 card 的 p-4 区域不可点 | minor 热区 | button 覆盖整卡或去掉内层留白 |

## 2. 设备详情（SubHardwareActivity → pages/devices/[id].vue）

| element | native evidence | current H5 | delta | action |
|---|---|---|---|---|
| 标题 | `SubHardwareActivity.java:192` `tv_device_detail`=设备详情 | `[id].vue:160` `device.nick`/`device.title` | **blocking** 首屏标题不同 | 固定“设备详情”或产品确认 |
| 顶部区 | `activity_sub_hardware.xml:28-76` 56dp 头像+16dp 编辑点、18sp 名称、12sp 激活时间 | `[id].vue:170-204` 64px Avatar、16px 名称、铅笔；激活时间移到信息行 | minor 结构/字号 | 决策：保留 H5，或激活时间回到头像下 |
| 信息区 | `activity_sub_hardware.xml:113-157` 纵向 16sp 文本，IMEI 后“\| 复制” | `[id].vue:200-238` dt/dd 两列 14px + 复制图标 | minor 呈现方式 | 保留 H5 两列（需确认） |
| 缴费充值 | `activity_sub_hardware.xml:122-136` “缴费充值”文字+图标；`SubHardwareActivity.java:309-314` 按设备续费 | `[id].vue:305-320` 仅“待续费设备/流量卡充值记录”导航 | **blocking** 缺按设备续费入口 | 补入口或明确不在本期范围 |
| 分组与顺序 | `activity_sub_hardware.xml:240-388` 群组/联系人/紧急→位置/轨迹/上报/提醒→解绑；`:397-419` 固定“发起聊天” | `[id].vue:277-334` 单个 9 项扁平 nav，位置组在前，无聊天 CTA | **blocking** 首屏结构不同 | 按原生分组重排（section 标题+panel），补/确认聊天入口 |
| 共享位置开关 | `activity_sub_hardware.xml:311-317` 位置卡片内 toggle；`SubHardwareActivity.java:397` 按能力位显示 | `[id].vue:268-275` 独立常显行 | minor 位置/权限门 | 按能力位隐藏 |
| 解绑入口 | `activity_sub_hardware.xml:381-387` danger 文字行；`SubHardwareActivity.java:390-394` 仅管理员可见 | `[id].vue:325-333` 所有人可见 + `border border-danger/40` | **blocking** 权限缺失 + **违反无边框规范**（uno.config.ts:41-46） | 按 administratorId 门控；改 btn-danger/panel row，去 border |
| 解绑弹窗 | `SubHardwareActivity.java:565` 提示/是否解除绑定设备？/确定；`strings tv_dialog_tips` | `[id].vue:344-360` 解绑设备/解绑后…「name」/取消·确认 | minor 文案 | 统一为原生文案 |
| 重命名 | `SubHardwareActivity.java:653-655` 标题“设备名称”预填 | `[id].vue:190` 标题“重命名设备” | minor 文案 | 统一标题 |

## 3. 位置 + 围栏（HardwareCheckLocationActivity / HardwareSetFenceActivity）

### 3.1 位置页 → pages/devices/[id]/location.vue + MapCanvas.vue

| element | native evidence | current H5 | delta | action |
|---|---|---|---|---|
| 标题 | `HardwareCheckLocationActivity.java:91` `tv_check_location`=位置和围栏 | `location.vue:123` `locationAndFence` | 一致 | 无 |
| 顶部信息 | `activity_hardware_view_location.xml:19-36` 仅省电模式提示条（80% 宽、12sp、可点进上报设置）；`Java:372-381` mode 2/3 隐藏 | `location.vue:128-162` 常驻浮动卡片：设备位置+时间+我的位置+围栏行 | **blocking** H5 多出常驻卡片，原生无对应物 | 保留卡片但确认信息取舍；警告文案/跳转对齐 |
| 地图控件 | `activity_hardware_view_location.xml:37-82` 指南针/我的位置/围栏 40dp/用户标记/上一点标记 40dp | `MapCanvas.vue:119-120` 仅 AMap Scale/ToolBar | **blocking** 缺“我的位置/围栏”快捷控件 | 补工具栏或明确 H5 用卡片入口替代 |
| 围栏入口 | `HardwareCheckLocationActivity.java:196-199` 图标点击：无围栏→添加确认→设置页；有围栏→删除确认 | `location.vue:153-161` 卡片行→fence 页；删除在 `fence.vue:220-228` | minor 流程不同 | 保留 H5，记录差异 |
| 围栏圆样式 | `Java:69-71` fill `argb(20,1,1,1)`、stroke `#00FF00` width 5 | `MapCanvas.vue:84-92` fill `#83c7d4` 22%、stroke `#16c784` width 2 | minor 视觉 | 可调色/描边；录屏确认 |
| 标记 | `Java:277-308` 用户头像 marker；`activity_...:63-82` 用户/上一点图标 | `MapCanvas.vue:57-79` 默认 pin + 蓝色圆点 | minor | 可接受 |
| 警告文案 | `strings tv_location_mode_close_hint` / `tv_save_power_mode_hint` | zh-CN `fenceDisabledTip` / `fenceLowFrequencyTip` 完全一致 | 无 | 无 |
| 我的位置状态 | `Java:322-324` 无文字状态，仅 marker | `location.vue:137-151` 多行状态/重试 | minor H5 更多 | 保留 |

### 3.2 围栏页 → pages/devices/[id]/fence.vue

| element | native evidence | current H5 | delta | action |
|---|---|---|---|---|
| 标题 | `HardwareSetFenceActivity.java:149` `tv_electric_fence`=电子围栏 | `fence.vue:162` `fenceTitle` | 一致 | 无 |
| 中心点提示 | `Java:57` toast“请长按地图设置围栏中心点” | `fence.vue:174-178` 顶部浮层“点击地图设置围栏中心点” | **blocking** 文案+手势不一致 | 文案改“长按”；确认 H5 tap 还是 longpress（需录屏） |
| 中心地址 | `layout_hardware_fence.xml:17-31` 只读“围栏中心”；`Java:239,266` 反查地址并随围栏保存 | `fence.vue:199-210` 无地址展示/保存 | **blocking** 缺反馈与持久化字段 | 增加地址回显并随保存提交 |
| 半径控件 | `layout_hardware_fence_set.xml:7-63` 顶部 −/SeekBar/+，200/1000 标签 11sp；`Java:42-46,280-287` 默认 300、范围 200-1000、步长 50 | `fence.vue:27-29,190-196` 底部 sheet range，默认/范围/步长一致 | 取值一致、位置不同 | 设计系统差异 — 保留 H5 |
| 名称 | `Java:59,200-203` 保存后弹 EditDialog“设置围栏名称” | `fence.vue:199-210` 页面内联必填 | minor 流程 | 保留 H5 |
| 保存按钮 | `activity_hardware_set_fence.xml:52-61` 42dp、16sp bold、白字“保存” | `fence.vue:212-218` btn-primary 48px、“确定” | minor 文案/高度 | 文案改“保存” |
| 删除 | 原生本页无删除（仅位置页图标） | `fence.vue:220-228` btn-danger“删除围栏” | minor H5 更多 | 保留并记录 |
| 空中心保存 | `Java:57` toast“请长按地图设置围栏中心点” | `fence.vue` toast“请先在地图上选择围栏中心” | minor 文案 | 统一 |

## 4. 轨迹（HardwareTrackRecordActivity → pages/devices/[id]/track.vue + TrackCalendarModal.vue）

| element | native evidence | current H5 | delta | action |
|---|---|---|---|---|
| 标题 | `HardwareTrackRecordActivity.java:105` `tv_track_record`=轨迹记录 | `track.vue:160` `trackRecords` | 一致 | 无 |
| 日历入口 | `Java:106-111` 标题栏右 `icon_calendar` | `track.vue:166-174` 地图右上浮动日历按钮 | minor 位置 | 可移到 PageHeader `#action` |
| 日期标签 | `activity_hardware_track.xml:19-34` 选日期后才显示，右上，14sp，4/8dp 内边距，marginEnd 12dp；`Java:199-200` | `track.vue:162-165` 首屏常显、左上、40px 高、px-3 | **blocking** 初始可见性/位置/尺寸 | 首屏隐藏或与原生一致；录屏确认 |
| 首次进入 | `Java:128-133` 地图加载后自动弹日期选择 | `track.vue` 不自动弹 | **blocking** 流程 | 首次自动打开 TrackCalendarModal |
| 起/终/中间点 | `Java:59-67,288-304` 起终点图标+中间点，默认选中终点并显示地址卡 | `track.vue:184` 仅 recent marker + polyline；`MapCanvas.vue:57-105` 无起终点 | **blocking** 轨迹信息缺失 | 补起终点 marker |
| 底部地址卡 | `Java:320-340` 点 marker 显示名称/地址/更新时间；`item_hardware_location_layout.xml:7-55` | `track.vue` 无 | **blocking** 缺少 | 增加 marker 点击与地址卡 |
| 空态 | `Java:219` toast“暂无轨迹记录” | `track.vue:81,180-185` toast+浮层“当日无轨迹记录” | minor 文案 | 统一为“暂无轨迹记录”或保留日期口径 |
| 折线 | `Java:303` 纯绿 polyline | `MapCanvas.vue:94-105` `#16c784` width 5 | minor | 保留 |
| 日历弹窗 | `fragment_calendar_select_dialog.xml:9-58` 居中 CalendarView，标题 18sp bold，按钮 42dp 取消/确定 | `TrackCalendarModal.vue:60-73,113-130` 底部 sheet，标题 20px，按钮 48px 取消/确认 | 设计系统差异 — 保留 H5；确认按钮文案改“确定” | 保留 |
| 日期格式 | `Java:200` `%d/%d` | `track.vue:120` `M/d` | 一致 | 无 |

## 5. 轨迹上报频率（HardwarePowerSavingActivity → pages/devices/[id]/track-setting.vue）

| element | native evidence | current H5 | delta | action |
|---|---|---|---|---|
| 标题 | `HardwarePowerSavingActivity.java:74` `tv_power_saving`=轨迹上报设置 | `track-setting.vue:66` `trackSetting` | 一致 | 无 |
| 4 行文案 | `strings tv_hardware_location_mode_close/low/normal/high`=关闭/低频上报/中频上报/高频上报 | `track-setting.vue:22-27` frequencyOff/Low/Mid/High 同文案 | 一致 | 无 |
| 行高 | `activity_hardware_power_saving.xml:24-26` 最小 48dp、左右 16dp | `track-setting.vue:79` `min-h-16`=64px、`px-5` | minor 尺寸 | 设计系统差异 — 保留 H5 |
| 选中标记 | `activity_hardware_power_saving.xml:34-40` 右侧 48dp check 图标 | `track-setting.vue:87-89` 20px radio | 设计系统差异 — 保留 H5 | 保留 |
| 分割线 | `activity_hardware_power_saving.xml:42-48` 0.5dp divider | 无 | 设计系统差异 — 保留 H5 | 保留 |
| 成功反馈 | `Java:63-64` 仅更新选中，无 toast | `track-setting.vue:58` toast“轨迹上报频率已更新。” | minor H5 多 | 可保留 |
| 容器 | `activity_hardware_power_saving.xml:8-16` 12dp 外边距卡片 | `track-setting.vue:71` rounded-large 16px | 设计系统差异 — 保留 H5 | 保留 |

## 6. 群组（HardwareJoinSessionManageActivity sessionType=2 旧版 → pages/devices/[id]/groups/**）

> v5.0.8 的入口已改为 H5：`SubHardwareActivity.java:521-522` `Router.openSubHardwareGroupManagerActivity`；旧 layout 仅作参考，以下 H5 为当前设计基准。

| element | native evidence | current H5 | delta | action |
|---|---|---|---|---|
| 入口标题 | `HardwareJoinSessionManageActivity.java:149-155` 群组管理；旧行文案“从通讯录添加/按条件查找添加” | `groups/index.vue:35-45` 群组管理；“从管理员通讯录添加/按条件查找添加” | minor 文案更长 | 确认是否改回“从通讯录添加” |
| 分组 | `Java:216,239` 单列表 + “已加入”头 | `groups/index.vue:55-113` 我创建的/我加入的 | H5 为准（入口已切换） | 保留 |
| 空态 | `item_hardware_join_session_empty.xml:10` “空” | `groups/index.vue:52,59-64` “暂无群组”/“无” | minor | 保留 |
| 行 | `item_hardware_join_session_data.xml:16-32` 48dp 头像、16sp 名称、无副标题 | `groups/index.vue:69-80` card+名称+num+箭头 | H5 为准 | 保留 |
| 退出/解散弹窗 | `Java:434` “退出群组将删除该群聊天记录是否要继续?” | `groups/[groupId].vue:304` “退出后将不再接收{name}的消息。确定退出吗？” | minor 文案 | 统一（若需与旧版一致） |

## 7. 联系人（HardwareJoinSessionManageActivity sessionType=1 → pages/devices/[id]/contacts/**）

| element | native evidence | current H5 | delta | action |
|---|---|---|---|---|
| 标题 | `HardwareJoinSessionManageActivity.java:157` `tv_contacts_manager`=联系人管理 | `contacts/index.vue:35` | 一致 | 无 |
| 添加入口文案 | `Java:160-161` “从通讯录添加/按条件查找添加” | `contacts/index.vue:39-43` “从好友添加/搜索并添加” | **blocking** 首屏文案不同 | 改为原生文案 |
| 分组头 | `Java:239` “已加入” | `contacts/index.vue:49-50` “已添加联系人” | minor | 统一 |
| 行内容 | `item_hardware_join_session_data.xml:16-32` 48dp 头像+16sp 名称 | `contacts/index.vue:60-73` 头像+名称+微喇号+箭头 | minor H5 多显示 | 保留或确认 |
| 空态 | `item_hardware_join_session_empty.xml:10` “空” | “暂无联系人”（`contacts/index.vue:55-57`） | minor | 保留 |
| 添加好友弹窗 | `Java:299-307` 为什么添加此好友？/介绍一下自己/发送请求，预填“我是:nick”，允许空 | `contacts/add.vue:186-190` 申请留言/请输入申请留言，默认“我想添加你为好友。” | minor 文案/默认值 | 统一文案与默认值 |
| 删除好友 | `Java:436` 删除好友/确定删除该好友吗？ | `contacts/[contactId].vue:177` “确定要从联系人中删除{name}吗？” | minor | 统一 |
| 多选添加 | 原生 LocalUserFragment（选择器实现不可从 XML 判断） | `contacts/add.vue:109-170` 全选+复选框 | needs-media | 录屏确认 |

## 8. 紧急联系人（HardwareEmergencyContactActivity → pages/devices/[id]/emergency-contacts/**）

| element | native evidence | current H5 | delta | action |
|---|---|---|---|---|
| 区块顺序 | `activity_hardware_emergency_contact.xml:8-80` 提示 01/02 → 添加入口 → 列表 | `emergency-contacts/index.vue:96-152` 提示卡 → 列表 → 添加入口 | **blocking** 首屏顺序 | 重排为：提示→添加入口→列表 |
| 提示区 | `activity_hardware_emergency_contact.xml:8-27` 两条 12sp 次要文本，无标题/无卡片 | `emergency-contacts/index.vue:96-112` 卡片+“温馨提示”+3 条 | minor 视觉 | 去标题或用 section 标题，保留 H5 卡片 |
| 添加入口 | `activity_hardware_emergency_contact.xml:36-60` 53dp 白底行，左文案右箭头 | `emergency-contacts/index.vue:144-151` nav-item，右 plus 图标 | minor 图标/高度 | 改箭头，高度按 H5 |
| 列表行 | `item_emergency_contact.xml:6-45` 55dp、44dp 头像、14sp/11sp；`EmergencyContactListAdapter.java:72-75` 整行点击删除确认 | `emergency-contacts/index.vue:114-140` panel 内无 `px` 的 li、16px/12px、右侧带 border 的“−”，行不可点 | **blocking** 缺内边距 + **border 违规** + 删除交互不同 | 行加 `px-4`；去 border 改 `i-ph-minus`；整行或按钮触发确认 |
| 删除弹窗 | `HardwareEmergencyContactActivity.java:153` 删除紧急联系人/删除后，该联系人将无法收到紧急呼叫，确定继续吗？/确定 | `emergency-contacts/index.vue:167` “确定要删除紧急联系人{name}吗？” | minor 文案 | 统一 |
| 上限提示 | `Java:200-215` “最多可添加%d个好友/电话联系人” | `index.vue:52-74` 同文案 | 一致 | 无 |
| 添加电话页 | `fragment_phone_contact_edit.xml:7-63` 图标→电话→姓名→提示→保存 42dp | `add-phone.vue:66-113` 圆头像→panel 两行→保存→提示 | 设计系统差异 — 保留 H5；占位符/保存文案一致 | 保留 |

## 9. 提醒（HardwareReminderListActivity / EditActivity → pages/devices/[id]/reminders/**）

| element | native evidence | current H5 | delta | action |
|---|---|---|---|---|
| 列表字号层级 | `item_hardware_reminder.xml:9-39` 24sp 时间、16sp 内容、16sp secondary 重复 | `reminders/index.vue:60-63` 24px/14px/12px | **blocking** 字号层级不同 | 内容/重复改 16px（text-header）或确认 H5 层级 |
| 卡片 | `item_hardware_reminder.xml:4-7` padding 12dp、margin 12dp | `reminders/index.vue:53-54` card p-4 + space-y-3 | minor | 保留 |
| FAB | `activity_hardware_reminder_list.xml:21-32` 绿色底+白加号、32dp 边距、居中 | `reminders/index.vue:70-77` 白底 fab+primary 图标、bottom-8 居中 | 设计系统差异 — 保留 H5 | 保留 |
| 点击行为 | `HardwareReminderListActivity.java:143-165` 打开 ReminderTimeDialog（确认/删除/更多设置） | `reminders/index.vue:55-65` 直接进入编辑页 | needs-media / **blocking** 流程 | 录屏确认；如需一致需加时间弹窗 |
| 空态 | adapter 无空视图 | `reminders/index.vue:49-50` “暂无提醒” | minor | 保留 |
| 编辑页结构 | `activity_hardware_reminder_edit.xml:25-79` TimePicker spinner 12h + 重复/内容/时长/次数/间隔 | `reminders/[reminderId].vue:310-345` 时间卡+内容+4 行 | needs-media 时间控件 | 录屏确认 |
| 标题栏保存 | `HardwareReminderEditActivity.java:202-211` 右侧“确定”绿色 | `[reminderId].vue:296-305` 右侧“保存/确定” | 文案 modal.ok=确定 | 统一为“确定” |
| 空内容 | `Java:43-58` AlertDialog“提醒内容为空，是否进入内容编辑界面？” | `[reminderId].vue:135-139` toast“请输入提醒内容” | minor 流程 | 统一 |

## 10. 围栏入口 + 位置卡片（同 3，补充入口层）

| element | native evidence | current H5 | delta | action |
|---|---|---|---|---|
| 常驻信息卡 | 原生无（仅省电模式提示条，`activity_hardware_view_location.xml:19-36`） | `location.vue:128-162` 设备位置+时间+我的位置+围栏行 | **blocking** H5 多出常驻卡片 | 产品确认卡片信息；保留则记录为 H5 增强 |
| 围栏入口形态 | `activity_hardware_view_location.xml:53-62` 右侧 40dp 围栏图标 | `location.vue:153-161` 卡片内导航行 | 设计系统差异 — 保留 H5 | 保留 |
| 频率警告入口 | `HardwareCheckLocationActivity.java:411-424` 顶部提示条可点进上报设置 | `location.vue:164-170` 底部浮动卡→track-setting | minor 位置 | 保留；确认不遮挡地图控件 |

## 优先级工作清单

### P0（首屏即见，建议本轮修）
- **设备列表**：副标题改为群组数（1）。
- **设备详情**：标题固定“设备详情”；解绑按管理员门控并去掉 `border`（违反无边框规范）；按原生重排分组/顺序；补“发起聊天”与按设备“缴费充值”入口（或明确范围）。
- **位置/围栏**：位置页补“我的位置/围栏”快捷控件；围栏页补中心地址回显与保存；修正“长按/点击”文案；保存按钮文案改“保存”。
- **轨迹**：首屏自动弹日期选择；日期标签初始隐藏/位置对齐；补起终点 marker 与点选地址卡。
- **紧急联系人**：区块顺序改为 提示→添加入口→列表；列表行加 `px-4`、去掉圆形按钮 border、整行可点删除。
- **提醒**：列表内容/重复字号与原生 16sp 对齐。
- **联系人**：添加入口文案改回“从通讯录添加/按条件查找添加”。

### P1（结构决策/流程，随后修）
- 设备详情信息区两列 vs 原生纵向的最终口径；激活时间位置；共享开关权限门。
- 轨迹日历按钮移至标题栏；空态文案统一。
- 提醒列表点击是否先弹时间对话框；编辑页时间控件形态。
- 围栏删除入口保留在 fence 页的说明；围栏半径控件位置。
- 群组/联系人删除、退出弹窗文案统一。

### P2（细节/一致性）
- 空态、成功 toast、复制/删除图标的统一（`i-ph-*` 替代文字/减号）。
- 地图 marker、围栏圆、轨迹线颜色（#16c784 vs 原生 #00FF00）与粗细。
- 设备列表头像 44→48、行内边距视觉节奏。
- 紧急联系电话/姓名页与原生提示区文案一致性的最终确认。

## 需要录屏回答的问题

1. 设备详情：管理员与普通成员分别是否显示“解绑”？底部“发起聊天”在 H5 是否仍需保留？
2. 位置页：原生右侧“围栏/我的位置/上一点”图标是否必须？H5 常驻信息卡是否可接受？
3. 围栏页：设置中心是长按还是单击？原生“围栏中心”地址是否会随保存回填到再次进入？
4. 轨迹：首次进入是否自动弹日期选择？点 marker 的地址卡是否必须？起终点图标是否必须？
5. 轨迹：日期标签在选择前是否应隐藏？日历入口放标题栏还是地图浮层？
6. 提醒：点卡片是“时间对话框（确认/删除/更多）”还是直接进编辑页？系统 time picker 是否可替代原生 12h spinner？
7. 紧急联系人：删除是点整行还是右侧按钮？提示区是否要“温馨提示”标题？
8. 设备列表副标题：群组数（n/m）还是型号/IMEI？
9. 联系人添加弹窗：默认留言用原生“我是:nick”还是 H5“我想添加你为好友。”？
10. 群组页：入口已切 H5，是否还要把“从管理员通讯录添加”改回旧版“从通讯录添加”？
11. 动画/滚动/间距：地图缩放与半径拖动的实时反馈、列表滚动惯性、围栏圆拖动跟手程度。
12. 颜色：轨迹/围栏的绿色是否统一为 H5 品牌绿 #16c784，还是保留原生纯绿？

## 总结

最大差距集中在“首屏结构与信息口径”，而非颜色或间距：设备详情的标题/分组/解绑权限与 H5 扁平列表差异最大，其次是紧急联系人的区块顺序和列表行样式（还带一处 `border` 违反 H5 无边框规范），轨迹页缺少原生自动日期弹窗、起终点 marker 与点选地址卡，围栏页缺少中心地址回显并把“长按设中心”写成“点击”。设备列表副标题（群组数 vs 型号/IMEI）和联系人添加入口文案属于首屏即见的低成本高收益修正；其余多为状态文案、图标形态与地图样式，可按 P1/P2 逐步收敛。原生与 H5 的颜色 token 基本同源，绿色主色与 0.5/2dp 描边属于设计系统差异，建议保留 H5，不做反向复刻。
