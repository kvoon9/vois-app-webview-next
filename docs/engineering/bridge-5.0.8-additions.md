---
description: 'App 5.0.8 桥接变更记录与 H5 侧接入说明：新增了哪 5 条协议、H5 怎么用、轮询与回退策略、遗留问题。完整字段定义见 /native/bridge-contract。'
---

# App 5.0.8 桥接变更与 H5 接入

完整字段定义、错误码和 iOS 平台映射以 [/native/bridge-contract](/native/bridge-contract) 为准；本文只记录 5.0.8 相对 5.0.4 的变更，以及 H5 侧的实际用法。

## 新增协议

5.0.4 基线只有 `close-page`、`get-page-params`、`wechat-app-prepay` 三条。5.0.8 在同一通道上新增 5 条，分三批构建：

| 协议 | 首次构建 | H5 消费方 |
| --- | --- | --- |
| `start-location` / `get-location` | 10151723 | `useRealtimeLocation` |
| `get-permissions` | 10191150 | `useRealtimeLocation`（仅 UI 文案）、`permission-test` |
| `write-clipboard` / `read-clipboard` | 10201402 | `copyToClipboard`；`read-clipboard` 暂无调用方 |

传输、响应信封、`close-page` / `get-page-params` 的行为都没变，**仍然没有原生 → H5 的事件或推送通道**。早期设想的 `subscribe-device-location` 推送方案已废弃：[/engineering/realtime-location-bridge](/engineering/realtime-location-bridge)。

## H5 侧实现

| 文件 | 职责 |
| --- | --- |
| `apps/website/src/utils/bridge/location-bridge.ts` | 定位 / 权限协议类型、钳制常量、错误码 |
| `apps/website/src/composables/useRealtimeLocation.ts` | 轮询循环、续期、退后台暂停、重试与错误状态、调试源 |
| `apps/website/src/pages/devices/[id]/location.vue` | 位置页实时红点与底部状态条 |
| `apps/website/src/pages/permission-test.vue` | dev/debug 权限测试页（6 组查询 + 弹窗链） |
| `apps/website/src/utils/bridge/clipboard-bridge.ts` | 原生剪贴板写入 + 1s 超时 + 能力回落 |
| `apps/website/src/utils/clipboard.ts` | 统一复制回退链 |

### 定位轮询

- 默认 5s 轮询、30s 会话；到期前一拍再发 `start-location` 续期（`time - interval - 1s`），不留缝隙。
- 每次挂载、每次页面重新可见都开一轮新的 `start`，不用权限查询拦截；权限询问交给原生的弹窗链路。
- 页面隐藏即停轮询；`1001` 之后重新可见不会自动重试，需要用户点状态条或重新进页面。
- `get-location` 超时 5s 计为漏掉一拍；回非 0（会话过期）就重新 `start`。
- `start-location` 的 `-1` 分两种：`"permission request in progress"` 按 2 倍间隔最多重试 12 次；其他 `-1` 按间隔最多重试 3 次；仍失败进入可重试的 `error` 状态。
- `start-location` 最长等 90s；超时视为本轮失败，落到可重试错误态。
- `get-permissions` 只用于等待文案，从不决定是否发请求；查询失败或缺 key 一律当 `unknown`。

DevServer 没有原生桥时，`createPageLocationSource()` 会替换成绕中心点画圈的调试源（3s 一拍、30s 窗口），让 ego-browser 能跑通整个流程。

### 剪贴板回退

```
原生 write-clipboard（1s 超时）
  → navigator.clipboard.writeText
  → 临时 textarea + 选中 + execCommand('copy')
```

任一层成功即返回 `true`；三层都失败才向用户报复制失败。能力检测用 UA（`isAndroid() || isIOS()`）而不是 `isSupportBridge()`，避免 DevServer 调试桥对未实现类型假装成功。调用方是 `PageHeader.vue`（复制当前 URL）和 `devices/[id].vue`（复制设备号）。

## 遗留问题

- **`read-clipboard` 尚无调用方**：类型已登记，等有「粘贴」场景再接。
- **`sensitive` 尚未使用**：当前复制的 URL / 设备号不是敏感内容，需要时再传。
- **实时点未处理 `wgs84`**：H5 直接按 `gcj02` 绘制；iOS 若返回 `wgs84` 会有偏移，需要先补 H5 偏移或固定返回 `gcj02`。
- **支付字段命名不一致**：Android 实现用 `prepayid`，H5 类型用 `prepay_id`，且 H5 类型多一个 `appid`；接线前先统一。
- **iOS 未验证**：5.0.3 只做了侦察，桥的 payload key 还没读出；5 条新协议未在 iOS 确认。

## 证据与提交

| 提交 | 内容 |
| --- | --- |
| `9033829` | 定位轮询落地（`start-location` / `get-location`） |
| `bb8afd9` | 权限弹窗挂起期间继续等待 |
| `ace0aed` | 接入 `get-permissions`、权限测试页、90s leash |
| `41c60bc` | 原生剪贴板优先 + 网页回退链 |

协议证据：`docs/native/android/v5.0.8+508/`（artifact 在 `docs/native/index.json`）。验证流程：`.pi/skills/verify-vois-webview/features/device-location.md`。
