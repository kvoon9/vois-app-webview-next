---
description: 'H5 ↔ App 桥接的完整数据规格：通道与握手、响应信封、九条协议的请求/响应字段、错误码、页面参数目录、iOS 平台映射与一致性测试清单。'
navigation:
  title: 'Bridge contract'
---

# H5 ↔ App 桥接数据规格

这份文档是 H5 与 App（Android / iOS）之间桥接的**唯一数据契约**。字段名、类型、错误码以本文为准；Android 的实现证据在 `docs/native/android/`，iOS 侧尚未从安装包验证，标为「待验证」的条目需要 iOS 按本文实现、真机回归后回填。

状态标记：

| 标记 | 含义 |
| --- | --- |
| **已观测** | 从 Android APK（5.0.4 / 5.0.8）反编译确认，证据在对应版本文档 |
| **H5 约定** | `@vois/webview-bridge@0.6.0` 的实际行为，改协议前先看这一层 |
| **待验证** | 依据 H5 约定与平台能力推导，iOS 未确认 |

字段名与 JSON 结构是协议的一部分，不能改名、不能省略必填字段。

## 1. 通道

### 1.1 总览

| 项 | Android（已观测） | iOS（待验证） |
| --- | --- | --- |
| Handler 名 | `uniBridgeCall` | `uniBridgeCall` |
| 请求通道 | WVJB `callHandler('uniBridgeCall', jsonString, callback)` | `window.webkit.messageHandlers.uniBridgeCall.postMessage(jsonString)` |
| 就绪信号 | `window.WebViewJavascriptBridge` + `WebViewJavascriptBridgeReady` 事件 | 无事件；H5 每 50ms 轮询 handler 是否存在 |
| 响应通道 | WVJB callback，收到原始字符串 | native 调用 `window[callbackName](jsonString)` |
| 响应关联 | WVJB 的 `callbackId`（传输层自动处理） | H5 生成 `callbackName`，native 原样回传 |
| 原生 → H5 推送 | 无 | 无 |

两端都**只有请求/应答**：没有事件、没有订阅、没有未经请求的推送。需要「持续数据」的协议（如实时定位）由 H5 轮询实现。

### 1.2 请求

H5 → native 的 `postMessage` / `callHandler` 参数是一段 **JSON 字符串**：

```json
{
  "type": "get-page-params",
  "data": { "page": "/devices", "params": ["theme", "lang"] },
  "callbackName": "bridge_callback_get_page_params_1"
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | 是 | 协议名，区分大小写，见第 2 节目录 |
| `data` | object | 是 | 请求体；无参数时 H5 也发 `{}`，不会省略 |
| `callbackName` | string | iOS 响应必填 | 仅 iOS 出现；H5 只在需要应答时携带。native 必须原样使用，不能改写 |

iOS 关键点：

- `WKScriptMessage.body` 是 **String**，不是字典。先 `JSONSerialization` 解析，再取字段。
- `callbackName` 的格式是 `bridge_callback_<type 中的非标识符字符替换为 _>_<递增序号>`，例如 `bridge_callback_get_page_params_7`。不要假设固定值。
- 没有 `callbackName` 的请求是 fire-and-forget（目前只有 `close-page`），**不要**尝试回调。
- H5 每次请求生成唯一名字，应答后立即删除该函数。native 只能调用一次。

### 1.3 响应

响应必须是**一个 JSON 对象序列化后的字符串**，通过回调传回：

```json
{
  "type": "get-page-params",
  "errcode": 0,
  "errmsg": "",
  "data": { "theme": "light", "lang": "zh-CN" }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | 是 | 回显请求的 `type` |
| `errcode` | integer | 是 | `0` 成功；`-1` 通用失败；其它值见各协议 |
| `errmsg` | string | 是 | 成功时 `""`；失败时给可读原因 |
| `data` | object | 是 | 无数据时 `{}`；**不能是 `null`、数组或标量** |

规则：

- 四个字段永远存在。H5 会先校验信封，再读 `data`。
- 响应是字符串，不是对象。iOS 若把字典直接传给 JS 函数，H5 的 `JSON.parse` 会失败并抛 `BridgeProtocolError`。
- 一次请求恰好一个应答；成功和失败都必须应答（fire-and-forget 除外）。
- `data` 里允许出现协议未定义的额外字段，H5 会忽略；但已定义字段的类型必须匹配。
- 中文、引号、换行必须正确转义；建议用平台的 JSON 序列化器生成整段响应，再把它编码成 JS 字符串字面量（见 5.1）。

### 1.4 框架级错误

所有协议共用的失败应答（Android 已观测，iOS 建议保持一致）：

| 场景 | errcode | errmsg |
| --- | --- | --- |
| 请求没有 `type` | `-1` | `Missing type field` |
| 不认识的 `type` | `-1` | `Unsupported type: <type>` |
| handler 抛异常 | `-1` | `Handler exception: <message>` |
| `data` 不是对象 | `-1` | `Handler exception: ...` |
| 支付缺必填字段 | `-1` | `Missing: <逗号分隔字段名>` |

H5 目前只对定位的 `permission request in progress` 做字符串匹配，其余只看 `errcode`；但保持字符串一致能让双端日志和排查共用一套规则。

### 1.5 时序与超时

- 就绪：Android 等注入事件；iOS 轮询。两端都没有「就绪超时」，页面可能一直等待。iOS 必须在创建 `WKWebView` 时就注册好 handler，不要等 `didFinish`。
- H5 的调用超时由各调用方自己加：页面参数 / token 10s，定位 `get-location` 5s，`get-permissions` 5s，`start-location` 90s，剪贴板 1s。native 可以晚应答（权限弹窗、支付），但必须应答一次。
- 页面销毁或导航离开后，挂起的回调不再有意义；native 应丢弃，不要调用已不存在的 JS 函数。
- SPA 内路由切换不会重建 WebView，也不重新注入通道；`get-page-params` 每次调用都按当前 App 状态现算，没有缓存。

## 2. 协议目录

| type | 模式 | 首次可用版本 | H5 调用方 |
| --- | --- | --- | --- |
| `close-page` | send（无应答） | Android 5.0.4 | `usePageBack` |
| `get-page-params` | request | Android 5.0.4 | `usePageParams`、`bridge.getAccessToken` |
| `start-location` | request | Android 5.0.8 / build 10151723 | `useRealtimeLocation` |
| `get-location` | request | Android 5.0.8 / build 10151723 | `useRealtimeLocation` |
| `get-permissions` | request | Android 5.0.8 / build 10191150 | `useRealtimeLocation`、`permission-test` 页 |
| `write-clipboard` | request | Android 5.0.8 / build 10201402 | `copyToClipboard` |
| `read-clipboard` | request | Android 5.0.8 / build 10201402 | 暂无 |
| `wechat-app-prepay` | request | Android 5.0.4 | 暂无（H5 类型已声明） |
| `ios-app-prepay` | request | iOS 待验证 | 暂无（H5 类型已声明） |

## 3. 协议定义

### 3.1 `close-page`

关闭当前 WebView 页面，回到 App 原生界面。H5 在自身历史深度为 0 时发送，等价于原生返回键。

请求：

```json
{ "type": "close-page", "data": {} }
```

- 无 `callbackName`，不需要应答。Android 会先回一个空应答再关闭，但 H5 不等待。
- 不要清空 WebView 历史、不要把页面导航到空白；直接关闭承载它的 native 页面 / 返回上一级。
- H5 只有在没有可回退的应用内历史时才发；有历史时用前端路由回退，不会触发本协议。

### 3.2 `get-page-params`

读取 App 的页面参数。token、主题、语言、账号 id 等都由这一条提供。

请求：

```json
{
  "type": "get-page-params",
  "data": { "page": "/devices", "params": ["access-token", "login-id", "theme", "lang"] }
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | string | 否 | H5 当前路由路径（hash 路由去掉 query），仅用于 native 日志；Android 忽略它 |
| `params` | string[] | 否 | 要读取的键；省略、`null` 或空数组表示「全部」；返回顺序按请求顺序，不存在的键直接省略 |

响应：

```json
{
  "type": "get-page-params",
  "errcode": 0,
  "errmsg": "",
  "data": {
    "access-token": "<opaque>",
    "login-id": "441",
    "theme": "light",
    "lang": "zh-CN"
  }
}
```

`data` 是扁平的键值表，值是标量（string / number / boolean）。H5 会把标量统一转成字符串；**嵌套对象或数组会被丢弃**，所以不要返回 JSON 字符串以外的结构。

#### 参数目录

| 键 | 类型 | 含义 | Android（已观测） | iOS（待验证） |
| --- | --- | --- | --- | --- |
| `access-token` | string | App 当前登录账号的 IM token；H5 的 HTTP 鉴权唯一来源 | `IAccount#getToken()` | WLSDK 当前账号 token |
| `login-id` | string（十进制整数） | App 当前账号 id；无账号为 `"0"` | `ConfigManager#getLoginId()`，默认 `"0"` | WLSDK 账号 id；无账号返回 `"0"` |
| `theme` | string | App 主题 | `light` / `dark` | `light` / `dark`，跟随系统时解析成实际值 |
| `lang` | string | App 语言 | `zh-CN` / `zh-TW` / `en` | 按下表映射 |
| `device-type` | string | 平台标识 | `android` | `ios` |
| `pkg-name` | string | 应用包标识，建单时作为 `pkg_name` 上报 | `com.voistech.chat` | iOS bundle id，5.0.3 包为 `com.voistech.wechat`；需与后端确认 |
| `wxpay-appid` | string | 微信开放平台 app id | 有值 | iOS 不适用，可省略 |
| `pay-method` | string | 支付方式，建单时作为 `pay_method` 上报 | `wechat` | `apple_iap`（H5 代码注释已约定，待原生确认） |

语言映射（iOS Locale → `lang`）：

| Locale | 返回值 |
| --- | --- |
| `zh-Hans*`（含 `zh-Hans-CN`、`zh-CN`） | `zh-CN` |
| `zh-Hant*`（含 `zh-Hant-TW`、`zh-TW`） | `zh-TW` |
| 其它中文变体 | 简繁优先；无法判断时按系统语言返回原值 |
| 非中文 | `en` |

行为要求：

- 每次调用现算，不缓存；账号切换、语言/主题修改后，下一次调用必须反映新值。
- 只返回请求的键；未知键省略，不要用空字符串占位。
- 不带 `params` 会返回全部键，包含 token——H5 从不这样调用，但 native 可以按契约支持。
- H5 **不依赖启动 URL 上的参数**；即使 native 按 Android 的做法把默认参数追加到启动 URL，也以本协议的答案为准。
- `access-token` 属于敏感数据：不要写日志、不要拼进 URL、不要放进 WebView 的启动参数。H5 的调试捕获对 token 字段做脱敏。
- 没有 `access-token` 或为空时，H5 的 HTTP 请求会失败；宁可返回 `-1` 也不要用旧账号 token 顶替。
- `login-id` 必须是正整数字符串；`"0"` 或省略都表示「没有账号」，H5 会忽略。

iOS 取值建议：token / login-id 从 `WLSDK` 的当前登录态读取；主题取 App 自身设置（跟随系统时解析为实际 light/dark）；语言按上表映射 `Locale.preferredLanguages` 或 App 内语言设置。

### 3.3 `start-location`

打开一个有界的手机 GPS 会话。**这是手机自身的位置，不是子设备的位置。**

请求：

```json
{ "type": "start-location", "data": { "interval": 5000, "time": 30000 } }
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `interval` | integer | 是 | H5 期望的轮询间隔，毫秒；必须是正整数 |
| `time` | integer | 是 | 会话时长，毫秒；必须是正整数 |

参数校验与钳制：

- 缺失、非数字、0 或负数 → `errcode: -1`，`errmsg: "invalid interval/time"`。
- `interval = max(5000, interval)`。
- `time = min(60000, max(15000, time))`。
- 应答必须回显钳制后的实际值，H5 用它们安排轮询和续期。

成功：

```json
{ "type": "start-location", "errcode": 0, "errmsg": "", "data": { "interval": 5000, "time": 30000 } }
```

失败：

```json
{ "type": "start-location", "errcode": -1, "errmsg": "invalid interval/time", "data": {} }
```

权限未决（已有一次 start 的弹窗还没结束）：

```json
{ "type": "start-location", "errcode": -1, "errmsg": "location permission request in progress", "data": {} }
```

用户拒绝：

```json
{ "type": "start-location", "errcode": 1001, "errmsg": "permission denied", "data": {} }
```

会话语义：

1. 一次 `start-location` 打开一个 `time` 毫秒的会话，开始定位更新并启动会话定时器。
2. 会话期间重复 `start-location`：原地重置同一个会话的定时器（不是新开会话），继续定位，回 `0` + 实际参数。
3. **没有 stop 协议。** 会话到期后自动停止定位；后续 `get-location` 回 `-1`。
4. 权限未授权时，第一次 `start-location` 触发系统权限弹窗，**挂起应答**，直到用户选择：允许 → `0`；拒绝 → `1001`。
5. 弹窗挂起期间再次 `start-location`，立即回 `-1 "location permission request in progress"`。H5 依赖这个**精确字符串**做弹窗等待重试；iOS 必须照抄。
6. `1001` 之后，本轮不得再调用 `start-location` / `get-location`；用户去系统设置开启后，H5 下一次进入页面或点击重试会开新一轮。
7. App 退到后台：暂停定位更新，但会话定时器继续走；回到前台时若会话仍有效则恢复更新。
8. 页面/Activity 销毁：停止定位、丢弃会话；不需要额外通知 H5。

iOS 实现要点：

- 用 `CLLocationManager`；首次调用 `requestWhenInUseAuthorization()`，在 `locationManagerDidChangeAuthorization` 里决定挂起的 start 是回 `0` 还是 `1001`。
- `desiredAccuracy` 用 `kCLLocationAccuracyBest` 或 `kCLLocationAccuracyNearestTenMeters`；H5 默认 5s 间隔、30s 会话，不需要高频。
- 会话用**墙钟截止时间**而不是单纯 `Timer`：后台期间也要按时到期。
- 重复 start 只重置截止时间，不重复创建 manager。
- 用户拒绝后不要反复弹窗；H5 会展示「去设置」引导并停止本轮。

### 3.4 `get-location`

读取当前会话内最后一次定位。请求体固定为 `{}`。

请求：

```json
{ "type": "get-location", "data": {} }
```

成功（已有定位）：

```json
{
  "type": "get-location",
  "errcode": 0,
  "errmsg": "",
  "data": {
    "coordType": "gcj02",
    "location": {
      "latitude": 22.6305,
      "longitude": 114.0668,
      "altitude": 12.0,
      "accuracy": 30.0,
      "speed": 1.2,
      "bearing": 90.0,
      "time": 1791954485000,
      "name": "",
      "address": ""
    }
  }
}
```

成功但还没拿到第一帧：

```json
{ "type": "get-location", "errcode": 0, "errmsg": "", "data": { "coordType": "gcj02", "location": null } }
```

没有存活会话：

```json
{ "type": "get-location", "errcode": -1, "errmsg": "location not running", "data": {} }
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `coordType` | string | 否 | `gcj02`（高德/国内）或 `wgs84`（GPS）；缺省按 `gcj02` 处理 |
| `location` | object \| null | 是（键存在） | 会话内最后一次定位；第一帧之前为 `null` |
| `location.latitude` | number | 是 | 纬度，度 |
| `location.longitude` | number | 是 | 经度，度 |
| `location.altitude` | number \| null | 是 | 海拔，米 |
| `location.accuracy` | number \| null | 是 | 水平精度半径，米 |
| `location.speed` | number \| null | 是 | 速度，米/秒 |
| `location.bearing` | number \| null | 是 | 方向角，度 |
| `location.time` | integer | 是 | 定位时间，Unix 毫秒 |
| `location.name` | string \| null | 是 | POI 名称，没有则 `null` 或 `""` |
| `location.address` | string \| null | 是 | 逆地理地址，没有则 `null` 或 `""` |

行为要求：

- `get-location` 只读，不触发新定位、不延长会话。
- 会话内没有新帧时返回上一帧（允许旧数据），不要回 `-1`。
- 无会话（从未 start 或已到期）→ `-1 "location not running"`。
- 数值不要用字符串；`NaN` / `Infinity` 会让 JSON 序列化失败。
- 坐标系必须与数值一致。Android `baseCn` 返回 `gcj02`；在中国大陆，CoreLocation 通常已按 GCJ-02 返回，iOS 应返回 `gcj02`。**H5 目前直接按 `gcj02` 绘制实时点，不会对 `wgs84` 做偏移**；如果 iOS 返回 `wgs84`，红点会有偏移，需先改 H5 或固定返回 `gcj02`。

iOS 实现要点：

- `didUpdateLocations` 保存最后一帧；`time = timestamp.timeIntervalSince1970 * 1000`。
- `horizontalAccuracy < 0` 视为无效，`accuracy: null`。
- `course` 在 `course < 0` 时给 `null`；`speed` 同理。
- 逆地理（`name` / `address`）可选，失败就给 `null`，不要让整条应答失败。

### 3.5 `get-permissions`

查询权限组状态。**纯查询，不弹窗、不阻塞。**

请求：

```json
{ "type": "get-permissions", "data": { "params": ["location"] } }
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `params` | string[] | 否 | 要查询的组名；省略或空数组表示查询全部已知组 |

组名：

| 组名 | Android 含义（已观测） | iOS 映射（待验证） |
| --- | --- | --- |
| `location` | 精确定位 + 粗略定位都授予 | `authorizationStatus == .authorizedWhenInUse / .authorizedAlways` |
| `background-location` | 后台定位 | `authorizationStatus == .authorizedAlways`（并已开启后台定位能力） |
| `audio-recording` | 录音 | `AVAudioApplication.shared.recordPermission == .granted` |
| `camera` | 相机 | `AVCaptureDevice.authorizationStatus(for: .video) == .authorized` |
| `nearby-devices` | 附近设备（蓝牙扫描/连接） | `CBManager.authorization == .allowedAlways` |
| `notification` | 通知开关 | `UNUserNotificationCenter` 授权状态为 `.authorized` / `.provisional` / `.ephemeral` |

响应：

```json
{ "type": "get-permissions", "errcode": 0, "errmsg": "", "data": { "location": false } }
```

- `errcode` 恒为 `0`（只要 handler 存在）。
- `data` 是组名 → 布尔值的映射。
- **未知组名静默省略**，不返回 `false`。缺失的键表示「不知道」，不是「拒绝」。iOS 没实现的组也应省略。
- 不触发任何权限弹窗；`.notDetermined` 与 `.denied` 一样返回 `false`。
- 通知查询在 iOS 是异步的，可以延迟应答，但不能因为等待而阻塞其它请求。

H5 目前只用它给等待文案打标签，**从不**用它决定是否发 `start-location`。`permission-test` 页会查询全部 6 个组。

### 3.6 `write-clipboard`

写入系统剪贴板。

请求：

```json
{ "type": "write-clipboard", "data": { "text": "861490079048881", "sensitive": false } }
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `text` | string | 是 | 要写入的文本；空字符串或缺失视为错误 |
| `sensitive` | boolean | 否 | Android 13+ 标记敏感内容，预览中隐藏；iOS 忽略 |

成功：

```json
{ "type": "write-clipboard", "errcode": 0, "errmsg": "", "data": {} }
```

失败：

```json
{ "type": "write-clipboard", "errcode": -1, "errmsg": "text is required", "data": {} }
{ "type": "write-clipboard", "errcode": -1, "errmsg": "clipboard unavailable", "data": {} }
```

行为要求：

- 写入系统剪贴板，不弹确认、不读回校验。
- iOS：`UIPasteboard.general.string = text`；`sensitive` 无对应能力，忽略即可，不要因此报错。
- H5 的原生写入超时 1s；失败会依次回落 `navigator.clipboard` 和「临时选区 + execCommand」，所以 native 失败不会阻断复制。

### 3.7 `read-clipboard`

读取当前剪贴板文本。H5 暂无调用方，但协议保留。

请求：

```json
{ "type": "read-clipboard", "data": {} }
```

响应：

```json
{ "type": "read-clipboard", "errcode": 0, "errmsg": "", "data": { "text": "861490079048881" } }
```

- `data.text` 永远是字符串；剪贴板为空、不可读或无权限时返回 `""`，不要省略字段。
- iOS：`UIPasteboard.general.string ?? ""`。读取会触发系统的粘贴提示/横幅，且只在 App 前台时有意义。
- Android 10+ 后台读取返回空；H5 不应在后台依赖该协议。

### 3.8 `wechat-app-prepay`（Android only）

微信 App 支付。iOS 不实现，走 `ios-app-prepay`。

请求字段以原生实际读取的为准（`@vois/webview-bridge@0.6.0` 的 `WechatPrepay` 已对齐）：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `partnerid` | string | 是 | 微信商户号 |
| `prepayid` | string | 是 | 同时也是待处理支付的关联键 |
| `noncestr` | string | 是 | |
| `timestamp` | string \| number | 是 | 微信要求秒级时间戳，原生原样转发 |
| `sign` | string | 是 | |
| `extdata` | string | 否 | 透传给微信 |
| `appid` | string | 否 | **原生忽略**：appId 由 App 用自身构建配置传给 OpenSDK |

早期 H5 类型用的是 `prepay_id`，原生读的是 `prepayid`；`0.6.0` 已按原生改名，不要再写回 `prepay_id`，否则原生回 `Missing: prepayid`。H5 目前仍没有调用方。

响应（H5 类型 `WechatPayRes`，Android 已观测）：

```json
{
  "type": "wechat-app-prepay",
  "errcode": 0,
  "errmsg": "",
  "data": { "wxpaycode": 0, "prepayId": "…" }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `wxpaycode` | integer | 微信返回的原始 `errCode`；与 `errcode: 0` 同时为 0 才是成功 |
| `prepayId` | string | 非空时返回 |
| `extdata` / `wxtransaction` / `wxopenId` | string | 非空时返回 |

即时失败（如微信未安装）时 `data` 是 `{}`，连 `wxpaycode` 都没有，所以 H5 类型里 `data` 及上述字段全部可选。

支付是延迟应答：用户从微信返回后 native 才回包，可能跨页面。同一个 `prepayid` 的第二次请求会顶掉第一次，被顶掉的回 `-1 "Duplicate request overridden"`；页面销毁后挂起的回调丢弃。完整规则见 [/native/android/v5.0.4+504/wechat-pay](/native/android/v5.0.4+504/wechat-pay)。

### 3.9 `ios-app-prepay`（iOS，待验证）

H5 包已声明该协议，本仓库没有调用方；iOS 原生实现尚未从安装包确认。字段按 `@vois/webview-bridge@0.6.0` 的类型：

```json
{
  "type": "ios-app-prepay",
  "data": {
    "product_id": "com.voistech.wechat.renew.30",
    "product_name": "续费 30 天",
    "product_desc": "SIM 卡续费",
    "amount": 300,
    "currency": "CNY",
    "order_no": "optional-order-number"
  }
}
```

响应（H5 类型为无 `data` 的扁平信封）：

```json
{ "type": "ios-app-prepay", "errcode": 0, "errmsg": "" }
```

H5 包的类型只为该协议声明了 `errcode` / `errmsg`，是通用信封的已知例外；建议 native 仍额外带 `data: {}`，H5 会忽略，这样调试捕获和日志能沿用同一套解析。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `product_id` | string | 是 | App Store 商品 id |
| `product_name` | string | 是 | 商品名 |
| `product_desc` | string | 是 | 商品描述 |
| `amount` | integer | 是 | 金额，单位「分」 |
| `currency` | string | 是 | 币种，如 `CNY` |
| `order_no` | string | 否 | 业务订单号 |

接入前需要 iOS 确认：实际协议名、字段名、响应是否带 `data`、StoreKit 的交易完成/恢复/失败回调时机。在此之前不要把该协议写进验收标准。

## 4. 兼容与降级

- **能力探测靠应答，不靠版本号。** 旧构建对不认识的 type 回 `-1 "Unsupported type: ..."`，H5 据此回落或显示错误。
- 缺 `get-permissions`：H5 把权限状态当 `unknown`，只影响等待文案，不影响流程。
- 缺剪贴板协议：H5 自动回落到浏览器剪贴板／临时选区。
- 缺定位协议：位置页显示「我的位置未开始」或不可用状态，不影响轨迹、围栏和其余页面。
- 没有推送通道：不要为实时位置设计事件；H5 用 `start-location` + `get-location` 轮询。
- 页面参数缺失：H5 保留 `pending`/错误态，不会用 URL query 冒充；生产环境不读 URL 里的 token。
- iOS 旧版本若只实现了 `close-page` / `get-page-params`，其余协议按「不支持」处理即可，H5 会降级。

## 5. iOS 实现指引

### 5.1 注册与回调

在创建 `WKWebViewConfiguration` 时注册，handler 名固定：

```swift
let controller = WKUserContentController()
controller.add(UniBridgeHandler(webView: webView), name: "uniBridgeCall")
configuration.userContentController = controller
```

最小 handler 骨架（解析、分发、应答、转义）：

```swift
final class UniBridgeHandler: NSObject, WKScriptMessageHandler {
    static let name = "uniBridgeCall"
    private weak var webView: WKWebView?

    init(webView: WKWebView) {
        self.webView = webView
    }

    func userContentController(
        _ controller: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.name, let raw = message.body as? String else { return }
        guard let request = Self.decode(raw) else { return }

        let callbackName = request["callbackName"] as? String
        guard let type = request["type"] as? String else {
            if let callbackName {
                reply(callbackName: callbackName, type: "", errcode: -1,
                      errmsg: "Missing type field", data: [:])
            }
            return
        }

        let data = request["data"] as? [String: Any] ?? [:]
        handle(type: type, data: data) { errcode, errmsg, body in
            self.reply(callbackName: callbackName, type: type, errcode: errcode,
                       errmsg: errmsg, data: body)
        }
    }

    private static func decode(_ raw: String) -> [String: Any]? {
        guard let data = raw.data(using: .utf8) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    /// 应答必须是 JSON 字符串，并通过 window[callbackName] 调用。
    private func reply(
        callbackName: String?,
        type: String,
        errcode: Int,
        errmsg: String,
        data: [String: Any]
    ) {
        guard let callbackName,
              callbackName.range(of: #"^[A-Za-z0-9_$]+$"#, options: .regularExpression) != nil
        else { return }

        let envelope: [String: Any] = [
            "type": type,
            "errcode": errcode,
            "errmsg": errmsg,
            "data": data,
        ]
        guard let envelopeData = try? JSONSerialization.data(withJSONObject: envelope),
              let json = String(data: envelopeData, encoding: .utf8),
              let quotedData = try? JSONEncoder().encode(json),
              let quoted = String(data: quotedData, encoding: .utf8)
        else { return }

        // quoted 是 JSON 字符串字面量（含引号与转义），直接作为 JS 参数。
        let script = "window.\(callbackName)(\(quoted))"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script)
        }
    }
}
```

要点：

- `handle(type:data:reply:)` 对应第 3 节每个 `type` 的 switch，本文只给通道骨架；`reply` 的签名是 `(errcode, errmsg, data)`。
- `message.body` 是 String；不要按 `[String: Any]` 取。
- `JSONEncoder().encode(String)` 生成的 `"..."` 正好是合法 JS 字符串字面量，比手写转义安全；中文、引号、换行都能正确处理。
- `callbackName` 已由 H5 限制为 `[A-Za-z0-9_$]+`，仍然校验一次，避免拼接注入。
- 只在主线程调用 `evaluateJavaScript`；`WKScriptMessageHandler` 本身在主线程被调用。
- 每个请求只回一次；异步完成的 handler 要自己保存 `callbackName` 并在完成时回。页面销毁后丢弃。
- 错误也用完整信封返回，不要静默吞掉；H5 的调用方靠应答结束等待。

### 5.2 权限映射

见 3.5 的组名表。补充：

- `.notDetermined`、`.denied`、`.restricted` 都返回 `false`。
- `notification` 查询是异步的；可以在回调里再组装响应，但必须保证只回一次。
- 不要为了查询权限调用 `requestAuthorization`；`get-permissions` 是纯查询。
- 未实现的组直接省略，不要猜测。

### 5.3 定位映射

- `CLLocationManager.authorizationStatus` 决定 `start-location` 的结果：允许 → `0`，拒绝 → `1001`。
- 第一次 `start-location` 触发系统弹窗时，保留 `callbackName`，等授权回调再应答；期间再次 `start-location` 回 `-1 "location permission request in progress"`。
- 会话截止时间用墙钟；重复 start 只重置截止时间。
- 后台暂停 `startUpdatingLocation`，前台恢复；会话到期后即使前台也不再恢复。
- 坐标：中国大陆 CoreLocation 返回 GCJ-02，`coordType` 返回 `gcj02`；其它地区返回 `wgs84` 并确保 H5 已支持偏移（当前未支持，见 3.4）。
- `location` 在第一帧前为 `null`，`errcode` 仍为 `0`。

### 5.4 剪贴板

```swift
UIPasteboard.general.string = text                 // write-clipboard
let text = UIPasteboard.general.string ?? ""       // read-clipboard
```

- 写入失败（例如系统限制）回 `-1 "clipboard unavailable"`。
- `sensitive` 无 iOS 对应能力，忽略。
- 读取会弹系统粘贴提示；只在用户明确触发「粘贴」时调用，H5 目前没有 read 调用方。

### 5.5 支付

- Android：`wechat-app-prepay`，字段已与 H5 类型对齐（`prepayid`，见 3.8），原生不要再改名。
- iOS：`ios-app-prepay`，待确认（见 3.9）。StoreKit 交易完成后回一次应答；用户取消、失败、恢复购买分别对应不同 `errcode`，需要与 H5 约定。
- 支付是唯一可能长时间延迟应答的协议；`callbackName` 要跨页面存活到交易结束，页面销毁则丢弃。

### 5.6 线程、大小与编码

- 所有 UI/WebView 操作在主线程；耗时工作（定位首帧、权限查询、StoreKit）异步，完成后主线程应答。
- 响应保持小体积（几 KB 内）；不要返回整份账号资料或日志。
- 统一 UTF-8；不要手工拼接 JSON 字符串。
- 浮点数不要输出 `NaN` / `Infinity`；无效值用 `null`。

## 6. 一致性测试清单

### 6.1 协议级测试向量

| 请求 | 期望 |
| --- | --- |
| `{"type":"close-page","data":{}}` | 不做应答；页面关闭 |
| `get-page-params {params:["theme","lang"]}` | `errcode:0`，只含这两个键，值为字符串 |
| `get-page-params {params:["nope"]}` | `errcode:0`，`data:{}` |
| `start-location {interval:1000,time:1000}` | `errcode:0`，`data:{interval:5000,time:15000}` |
| `start-location {interval:0,time:30000}` | `errcode:-1`，`errmsg:"invalid interval/time"` |
| `get-location {}`（无会话） | `errcode:-1`，`errmsg:"location not running"` |
| `get-location {}`（会话中、首帧前） | `errcode:0`，`data.location:null` |
| `get-permissions {params:["location","nope"]}` | `errcode:0`，只含 `location`，未知组省略 |
| `write-clipboard {text:""}` | `errcode:-1`，`errmsg:"text is required"` |
| `read-clipboard {}`（空剪贴板） | `errcode:0`，`data.text:""` |
| `{"type":"nope","data":{}}` | `errcode:-1`，`errmsg:"Unsupported type: nope"` |
| `{"data":{}}`（无 type） | `errcode:-1`，`errmsg:"Missing type field"` |

### 6.2 真机验收

- 登录后进入任意页面：HTTP 请求带 `access-token` 成功；杀掉 App 重进仍正常；切换账号后新 token 生效。
- `theme` / `lang` 跟随 App 设置；修改 App 语言或主题后重进 H5，值与界面一致。
- `login-id` 与 App 当前账号一致；退出登录后为 `"0"` 或省略。
- 页面参数里 `device-type` = `ios`；`pay-method` = `apple_iap`；`pkg-name` 与后端约定一致。
- 在 H5 首页（历史深度 0）点返回：App 关闭该页面；在二级页返回：只回退 H5 路由，不关闭页面。
- 定位允许：第一帧在数秒内出现，红点按间隔更新；30s 会话在到期前续期；退后台暂停、回前台恢复；关闭页面后停止更新。
- 定位拒绝：回 `1001`；H5 显示去设置文案；去设置授权后，重新进入页面能开始定位。
- 权限弹窗挂起期间再次 `start-location`：收到 `-1 "location permission request in progress"`；弹窗结束后下一次 `start-location` 成功。
- `get-permissions` 不弹任何系统弹窗；已授权/未授权状态与实际一致；未实现的组不出现。
- 复制设备号、复制当前 URL：原生剪贴板写入成功；旧构建（无协议）时自动回落且仍能复制。
- 所有请求都只收到一次应答；不支持的 type 回 `-1` 而不是崩溃或静默。
- 响应为合法 JSON 字符串；中文地址、引号、换行经定位/页面参数返回后不乱码、不截断。

### 6.3 调试环境说明

DevServer（`isWebviewDebug()` / `import.meta.env.DEV`）里有一套调试桥，会对页面参数、定位等给出模拟应答，方便浏览器自动化；它**不能替代真机验证**。剪贴板在调试环境走浏览器路径（UA 不是 Android/iOS）。iOS 验收必须用真机 + App 构建。

## 7. 变更与证据

### 7.1 5.0.8 新增

| 提交 | 内容 |
| --- | --- |
| `9033829` | 定位轮询落地（`start-location` / `get-location`） |
| `bb8afd9` | 权限弹窗挂起期间继续等待 |
| `ace0aed` | 接入 `get-permissions`、权限测试页、90s leash |
| `41c60bc` | 原生剪贴板优先 + 网页回退 |

协议证据：

- [/native/android/v5.0.8+508/location-bridge](/native/android/v5.0.8+508/location-bridge)
- [/native/android/v5.0.8+508/permission-bridge](/native/android/v5.0.8+508/permission-bridge)
- [/native/android/v5.0.8+508/clipboard-bridge](/native/android/v5.0.8+508/clipboard-bridge)
- [/native/android/v5.0.4+504/bridge-protocol](/native/android/v5.0.4+504/bridge-protocol)（传输与基础信封）

H5 侧实现与行为说明：[/engineering/bridge-5.0.8-additions](/engineering/bridge-5.0.8-additions)。

### 7.2 待确认

- iOS 实际 handler 名、请求体类型、回调函数名（`docs/native/ios/v5.0.3+1` 只做了侦察，payload key 尚未读出）。
- `ios-app-prepay` 的真实字段与响应形状。
- `device-type` / `pay-method` / `pkg-name` 的 iOS 取值需与后端确认。
- H5 实时点未对 `wgs84` 做偏移；iOS 若返回 `wgs84` 需要先补 H5 或固定 `gcj02`。
