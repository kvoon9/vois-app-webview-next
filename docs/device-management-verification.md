# 设备管理：首轮验证记录（2026-10-20）

> 2026-10-20，分支 `feat/device-management`。本文是**首轮验证记录**：只记当时**没验到的部分**和具体怎么验（真机 / DevServer 操作细节）。已完成与未完成的当前状态见 `docs/device-management-status.md`（唯一现状文档），逐屏差异见 `docs/uiux-alignment-plan.md`。截图与 capture 在 `apps/website/.tmp/verify/device-management-audit/`（gitignored）。

## 缺口清单

1. 当前 debug 账号下**没有轨迹、没有围栏、没有提醒、没有好友、没有 SOS 联系人**，接口一律 `errcode 0` + 空数组。空态能验，有数据的渲染验不了。
2. 手机自身定位走原生桥（`start-location` / `get-location`），只在 **安卓 App 5.0.8+** 的 WebView 里存在，DevServer 没有桥。
3. 解绑、删群、删好友、删提醒、SOS 增删、建充值单这类**不可逆写**没有执行，只做了请求级观察。
4. `sim_card` 已在真实响应里缺失，流量卡/充值这条线按约定不验。

## 真机 / DevServer 操作细节

### 1. 轨迹折线与围栏圆圈（需要真实数据）

先确认后端有没有数据：

```sh
# 在 Pi 里让 vois-debug MCP 代发（自动带登录态）
# path=/v2/subuser/track-get, body={"user_id":1848581,"date":"2026-10-20"}
```

有数据后：

```sh
cd apps/website && vp dev --host --port 3021
```

```js
// ego-browser
const t = await taskSpace("device track");
const p = t.page("p1");
await p.goto("http://localhost:3021/#/devices/1848581/track");
await new Promise(r => setTimeout(r, 2500));
await p.cdp("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await p.screenshot({ path: "/abs/path/track.png" });
```

看：折线是否连续、异常跳点是否被丢弃（`track.vue` 的 `filterJumps`）、确认日期后右上 `M/d` 徽标是否等于请求的 `date`。围栏同理：先 `POST /v2/subuser/geofence-set` 造一个，打开 `#/devices/<id>/location` 看圆圈，验完 `geofence-delete` 删掉。

### 2. 手机实时位置 / 权限弹窗（必须真机）

- 设备：安卓 **App 5.0.8+**，包内 WebView 打开 `https://api.voischat.cn/vois-app-webview-next/#/devices/<id>/location`（或本机 debug 地址带 `?login-id=`）。
- 允许定位 → 地图出现蓝点，`我的实时位置` 旁出现定位时间。
- 拒绝 → 原生权限弹窗或"去设置"；再次进入时页面显示"正在获取我的位置…"并可在点击后重试。
- 判定标准与桥协议见 `docs/native/android/v5.0.8+508/location-bridge.md`。

### 3. 写操作（用一台可牺牲的测试设备）

| 操作 | 入口 | 备注 |
| --- | --- | --- |
| 解绑设备 | 设备详情 → 解绑设备 → 确认 | 不可逆；成功后回列表 |
| 删群 / 退群 | 群详情 → 解散群组 / 退出群组 | 群主解散会移除全部成员 |
| 删好友 | 联系人详情 → 删除联系人 | 列表行点按即确认（原生语义） |
| 删提醒 | 编辑页 → 删除提醒 | **后端已知 bug**：返回成功但列表仍在 |
| SOS 增删 | 紧急联系人设置 | 删除会真的取消该对象的 SOS 通知 |
| 建充值单 | 待续费设备 | 本轮不验（后端无 `pay` 字段） |

每次：先截 UI，再读 `.tmp/vois-webview-debug/events.jsonl` 里对应 `network` 事件的 `requestBody` 和 `errcode`，用 `errcode`（不是 HTTP 200）判定。

### 4. 群权限与验证码（尚未对齐原生，需产品确认）

- 群主退群原生有三选一（直接解散 / 转让后退群 / 直接退群）+ 4 位本地验证码；H5 现在只有"解散群组"。
- 管理员现在能管理成员（`isAdmin` 已接入），但"拉黑/举报"没有入口。
- 可用两个账号（群主 + 管理员）在同一个群上点一遍来确认入口。

### 5. 深色模式与返回手势

- 深色：DevServer 切系统深色，重走详情/列表/围栏页，看 `surface-muted` 卡面、`fab`、地图叠加层是否仍有层次。
- 返回：从设备列表进详情点"返回"应 pop；冷启动直接打开 `#/devices/<id>` 点"返回"应向原生发 `close-page`（capture 里 `bridge` 事件）。本轮未复验。
