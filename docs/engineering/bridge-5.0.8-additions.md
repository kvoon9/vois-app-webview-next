---
description: 'App 5.0.8 新增的五条桥接协议（定位、权限、剪贴板）：契约、H5 侧接入、生命周期与兼容性坑，一页说明白给前后端和原生看。'
---

# 桥接新增内容（App 5.0.8）

> 整理于 2026-10-20，依据 `vender/` 里 5.0.8 的三个构建（反编译记录在 `docs/native/`）和已合并的 H5 代码（main `e189170`）。5.0.4 基线协议见 [/native/android/v5.0.4+504/bridge-protocol](/native/android/v5.0.4+504/bridge-protocol)。

## 一句话结论

5.0.4 只有 `close-page`、`get-page-params`、`wechat-app-prepay` 三条协议。5.0.8 在同一条 `uniBridgeCall` 通道上新增了 **5 条**，分三批构建：

- 实时定位：`start-location`、`get-location`（10151723）
- 权限查询：`get-permissions`（10191150）
- 剪贴板：`write-clipboard`、`read-clipboard`（10201402）

传输层、响应信封、`close-page` / `get-page-params` 的处理器都没有变，**仍然没有原生 → H5 的事件或推送通道**。实时位置因此是 H5 轮询实现，早期设想的订阅推送方案（`subscribe-device-location`）已废弃，只留作参考：[/engineering/realtime-location-bridge](/engineering/realtime-location-bridge)。

## 协议总览

| 协议 | 首次构建 | 用途 | 关键约束 |
| --- | --- | --- | --- |
| `start-location {interval, time}` | 10151723 | 打开一个有界 GPS 会话 | `interval` 下限 5000ms；`time` 夹在 15000–60000ms；应答回显夹取后的值；**没有 stop**，到点自动停 |
| `get-location {}` | 10151723 | 读会话内最后一次定位 | 不触发新定位；无会话时 `-1 "location not running"`；`coordType` 国内为 `gcj02` |
| `get-permissions {params?}` | 10191150 | 查询权限组状态 | 纯状态读取，不弹窗、不阻塞；`params` 省略即查全部；未知组名静默跳过（**没这个 key ≠ 被拒绝**） |
| `write-clipboard {text, sensitive?}` | 10201402 | 写系统剪贴板 | `text` 必填；`sensitive` 仅 Android 13+ 生效；旧包回 `-1 Unsupported type` |
| `read-clipboard {}` | 10201402 | 读当前剪贴板文本 | `data.text` 恒为字符串，不可读时是 `''`；Android 10+ 后台读拿不到内容 |

原始契约与反编译证据：

- [/native/android/v5.0.8+508/location-bridge](/native/android/v5.0.8+508/location-bridge)
- [/native/android/v5.0.8+508/permission-bridge](/native/android/v5.0.8+508/permission-bridge)
- [/native/android/v5.0.8+508/clipboard-bridge](/native/android/v5.0.8+508/clipboard-bridge)

## 定位：`start-location` / `get-location`

### 语义

桥给的是**手机自身的 GPS**，不是子设备的位置；它服务位置页里的「我的实时位置」。设备自己的位置仍走「当天轨迹最后一个点 + 围栏」的降级方案。

会话模型：

1. `start-location` 开一个 `time` 毫秒的会话，原生起一次性定时器；期间 `get-location` 返回会话内最后一帧。
2. 会话到期后 `get-location` 回 `-1`，需要重新 `start`。
3. 再次 `start` 会原地重置同一个会话的定时器，这就是续期机制，不产生缝隙。
4. 没有 stop 消息；页面隐藏或离开时 H5 停止轮询，会话自己到期。Activity 销毁时原生 `release` 停掉 GPS。

错误码：

| errcode | 含义 | 出现场景 |
| --- | --- | --- |
| `0` | 成功 | 正常路径 |
| `-1` | 拒绝 | 参数非法、权限弹窗未结束时再次 `start`、`get` 时没有存活会话 |
| `1001` | 用户拒绝定位权限 | 本轮不得再发 `start` / `get`，只能引导去系统设置 |

### H5 实现

`apps/website/src/utils/bridge/location-bridge.ts` 只做类型与常量：把三条协议挂到 `BridgeProtocolMap`，导出钳制边界、`1001` / `-1` 常量和 `BridgeLocation` 结构。

`apps/website/src/composables/useRealtimeLocation.ts` 拥有整个循环：

- 默认 5s 轮询、30s 会话；会话时长到期前一拍再发 `start` 续期（`time - interval - 1s`）。
- 每次挂载、每次页面重新可见都跑一轮新的 `start`，**不先用权限查询拦截**，让原生自己的权限弹窗链路负责询问体验。
- 页面隐藏即停轮询（省电、也不空转）；`1001` 之后重新可见不会自动重试，需要用户点状态条或重新进页面。
- `get` 超时 5s 计为漏掉一拍；`get` 回非 0（会话过期）就重新 `start`。
- `start` 的 `-1` 分两种：`"permission request in progress"` 按 2 倍间隔最多重试 12 次；其他 `-1` 按间隔最多重试 3 次；仍失败进入可重试的 `error` 状态。
- `start` 最长等 90s（原生可能在弹窗上挂很久）。超过 90s 视为本轮失败，状态落到可重试错误，下一次聚焦或点击重试重新开始。
- `get-permissions` 只用于 UI 文案（「定位权限未开启，请在弹窗中允许…」），从不决定是否发请求。查询失败或缺 key 一律当 `unknown`。

`apps/website/src/pages/devices/[id]/location.vue` 把结果画成底部状态条 + 实时红点；`createPageLocationSource()` 在没有原生桥的 DevServer 里替换成绕中心点画圈的调试点（3s 一拍、30s 窗口），使 ego-browser 能完整跑通流程。

权限测试页 `apps/website/src/pages/permission-test.vue`（`/permission-test`）只在 dev / debug server 暴露，逐个查询 6 个权限组，并可手动触发 `start-location` 的弹窗链，附原始调用日志。

## 权限：`get-permissions`

请求：

```json
{ "params": ["location"] }
```

应答：

```json
{ "type": "get-permissions", "errcode": 0, "errmsg": "", "data": { "location": false } }
```

支持的组名：`location`、`background-location`、`audio-recording`、`camera`、`nearby-devices`、`notification`。运行时权限要求组内每个权限都授予（`location` 需要 `ACCESS_FINE_LOCATION` 和 `ACCESS_COARSE_LOCATION` 同时有）；`notification` 读通知开关而不是运行时权限。

**必须知道的坑：权限弹窗会卡住 `start-location`。** 永久拒绝后原生弹「需要权限 / 去设置」对话框，用户点「去设置」会跳系统页但**不回包**：

- 挂起的 `start-location` 永远不回答；
- 原生的 `requestingPermission` 标志一直是 `true`，在 Activity 重建前，后续每次 `start` 都回 `-1 "location permission request in progress"`，即使用户真的在设置里开了权限。

产品上接受这个行为：H5 继续无条件发 `start`，让原生弹窗充当权限询问；卡住的那一轮由 90s leash 收进可重试错误态，重新聚焦会开新一轮。

## 剪贴板：`write-clipboard` / `read-clipboard`

- `write-clipboard` 写的是系统主剪贴板；空文本或不可用分别回 `-1 "text is required"` / `-1 "clipboard unavailable"`。
- `sensitive: true` 在 Android 13+ 标 `IS_SENSITIVE`，剪贴板预览里隐藏内容；旧版本忽略该字段。
- `read-clipboard` 应答 `data.text`，永不为 `undefined`；后台读在 API 29+ 返回 `''`，只有 App 前台时才有意义。
- 旧构建不认识这两个类型，统一回 `-1 "Unsupported type: write-clipboard"`。这个回答与真正的失败无法区分，处理方式也一样：回落网页路径，因此**不按版本号判断能力**。

H5 的复制路径在 `apps/website/src/utils/bridge/clipboard-bridge.ts` 和 `apps/website/src/utils/clipboard.ts`：

```
原生 write-clipboard（1s 超时）
  → navigator.clipboard.writeText
  → 临时 textarea + 选中 + execCommand('copy')
```

任一层成功即返回 `true`；三层都失败才向用户报复制失败。原生能力检测用 UA（`isAndroid() || isIOS()`）而不是 `isSupportBridge()`，避免 DevServer 调试桥对未实现类型假装成功。

当前调用方：`PageHeader.vue` 复制当前 URL、`devices/[id].vue` 复制设备号。

## H5 侧代码清单

| 文件 | 职责 |
| --- | --- |
| `apps/website/src/utils/bridge/location-bridge.ts` | 定位 / 权限协议类型、钳制常量、错误码 |
| `apps/website/src/composables/useRealtimeLocation.ts` | 轮询循环、续期、退后台暂停、重试与错误状态、调试源 |
| `apps/website/src/pages/devices/[id]/location.vue` | 位置页实时红点与底部状态条 |
| `apps/website/src/pages/permission-test.vue` | dev/debug 权限测试页（6 组查询 + 弹窗链） |
| `apps/website/src/utils/bridge/clipboard-bridge.ts` | 原生剪贴板写入 + 超时 + 能力回落 |
| `apps/website/src/utils/clipboard.ts` | 统一复制回退链（原生 → Clipboard API → 选区） |
| `apps/website/src/composables/usePageParams.ts` | 未变；仍是 `theme` / `lang` / `login-id` 等页面参数的唯一读取处 |
| `apps/website/src/utils/bridge/client.ts` | 未变；`getAccessToken()` 仍只走 `get-page-params` 的 `access-token` |

测试：`useRealtimeLocation.test.ts`（13 个用例）、`clipboard-bridge.test.ts`（5 个）、`clipboard.test.ts`（6 个），全部不依赖真机。

## 兼容性与未完成项

- **iOS**：5.0.3 只做了侦察，桥的 payload key 还没读出来；这 5 条协议未在 iOS 验证。剪贴板代码对 iOS 也会尝试原生写入，失败即回落。
- **`read-clipboard` 尚无调用方**：类型已登记，等有「粘贴」场景再接。
- **`sensitive` 尚未使用**：当前复制的 URL / 设备号不是敏感内容，需要时再传。
- **原生侧待修**：权限弹窗「去设置」后不重置 `requestingPermission`，导致授权成功后仍可能连续收到 `-1 permission request in progress`，直到 Activity 重建。H5 只能靠重试与重新聚焦掩盖。
- **没有 stop 协议**：会话只能等到期。H5 用短会话 + 续期规避，原生若后续加 stop 会更省电。
- **设备实时位置不是这套桥**：桥给的是手机 GPS；子设备位置仍靠 `geofence-get` + `track-get`，等后端补最近位置快照（`docs/device-management-feasibility.md` A5）。

## 证据与提交

| 提交 | 内容 |
| --- | --- |
| `9033829` | 定位轮询落地（`start-location` / `get-location`） |
| `bb8afd9` | 权限弹窗挂起期间继续等待 |
| `ace0aed` | 接入 `get-permissions`、权限测试页、90s leash 与重试策略 |
| `41c60bc` | 原生剪贴板优先 + 网页回退链 |

原始协议记录：`docs/native/android/v5.0.8+508/`（三个构建的 artifact 在 `docs/native/index.json`）。验证流程：`.pi/skills/verify-vois-webview/features/device-location.md`。
