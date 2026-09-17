# 桥接协议：`get-page-params`（H5 向 Native 索取页面参数）

H5 页面不知道自己要显示的数据从哪来，这部分信息只有 App 有（设备蓝牙地址、当前登录态、access-token 等）。
所以页面**先告诉 Native「我是谁、我需要哪些字段」，Native 再把对应字段的值回给页面**。

- 方向：H5 → Native，**请求 / 响应**（不是单向 `send`）
- 协议名：`get-page-params`
- 通道：`uniBridgeCall`（两端共用，收发格式由 `@vois/webview-bridge` 固定）
- 现值示例见 [第 3 节](#3-实际报文示例)

## 1. 请求（H5 → Native）

```jsonc
{
  "type": "get-page-params",
  "data": {
    "page": "/settings/bluetooth-ai-translate-active", // 当前页面路由（hash 路由里的 path）
    "params": ["uuid", "access-token"], // 本次页面需要的字段名（只给名字，不带类型）
  },
}
```

| 字段     | 类型       | 说明                                                               |
| -------- | ---------- | ------------------------------------------------------------------ |
| `page`   | `string`   | 页面路径，不含域名和 query。Native 以它为单位决定返回哪些字段      |
| `params` | `string[]` | 页面要用的字段名列表。**可能为空数组**，表示页面只要 `page` 本身。 |

`params` 只有名字，没有类型、没有必填标记。类型由 H5 侧自己按字段名声明（见 [第 4 节](#4-h5-侧约定)），
因为同一份数据在不同页面的类型只有在页面自己才知道。

> 一个字段名对应该页面上的一个 key。`params` 里出现的名字，Native 都应该在 `data` 里给一个值；
> 真拿不到（比如蓝牙没连）就省略该 key 或给 `null`，不要给空字符串冒充（页面无法区分「空」和「没有」）。

### 通道细节（由 bridge 库处理，Native 侧只需认这两点）

| 平台        | Native 收到什么                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Android** | `uniBridgeCall` 的 handler 拿到 `{"type":"get-page-params","data":{...}}`（JSON 字符串）；处理完调用 WVJB 的 `responseCallback(jsonString)`                          |
| **iOS**     | `uniBridgeCall` 的 script message handler 里 `message.body` 是 JSON 字符串；处理完执行 `window[callbackName](jsonString)`，`callbackName` 从请求体里取，**不要写死** |

**响应必须是 JSON 字符串**。只在请求侧出现 `callbackName`；`send` 类协议没有它，也就没有回包。

## 2. 响应（Native → H5）

沿用 App 内置支付协议的信封：

```jsonc
{
  "errcode": 0,
  "errmsg": "ok",
  "data": {
    "uuid": "5F2C1A3E-...-9B4D",
    "access-token": "eyJhbGciOi...",
  },
}
```

| 字段      | 类型                  | 说明                                                       |
| --------- | --------------------- | ---------------------------------------------------------- |
| `errcode` | `number`              | `0` 表示成功（H5 只判断是否等于 0，不解析其它值）          |
| `errmsg`  | `string`              | `errcode != 0` 时展示给页面；成功时给 `"ok"` 即可          |
| `data`    | `object`（key/value） | `params` 里每个名字对应当前值；**失败时可省略整个 `data`** |

值建议用 `string`（`uuid` / `access-token` / 语言代码 / 开关 `"0"`/`"1"` 都按字符串给），
数字和布尔也可以，页面会原样 JSON 显示。**不要嵌套对象**——页面目前只按一层 key/value 渲染，
要多层结构请给扁平的字段名（如 `device-name` 而不是 `device.name`）。

### 错误码（给前端的语义）

| `errcode` | 含义                | 页面表现                                      |
| --------- | ------------------- | --------------------------------------------- |
| `0`       | 成功                | 渲染 `data` 的 key/value                      |
| 非 `0`    | 失败                | 显示「App 未返回页面参数」+ `errcode: errmsg` |
| 不回包    | Native 没实现该协议 | 3 秒超时后显示「App 未返回页面参数」          |

具体业务码由 Native 定（如 `31` 表示登录失效），H5 不做映射，只把 `errmsg` 展示出来。

**超时约定**：H5 侧等待 3 秒。Native 该做的本地读取（蓝牙、登录态）要在这之内回包；
如果接的是网络请求，先回一个 `errcode: 0` 的占位再异步补，页面不接受第二次回包。

## 3. 实际报文示例

### Android

收到的 `uniBridgeCall` data（字符串）：

```json
{
  "type": "get-page-params",
  "data": { "page": "/settings/bluetooth-ai-translate-active", "params": ["uuid", "access-token"] }
}
```

`responseCallback` 传回：

```json
{ "errcode": 0, "errmsg": "ok", "data": { "uuid": "5F2C1A3E-9B4D", "access-token": "eyJhbGciOi" } }
```

### iOS

`uniBridgeCall` 收到：

```json
{
  "type": "get-page-params",
  "data": { "page": "/settings/bluetooth-ai-translate-active", "params": ["uuid", "access-token"] },
  "callbackName": "bridge_callback_get_page_params"
}
```

`callbackName` 由 H5 库按协议名生成，Native 直接用请求里给的值执行（不要自己拼）：

```swift
// 值是 JSON 字符串，不是对象
webView.evaluateJavaScript("\(callbackName)('\(jsonEscaped)')")
```

### 失败示例

```json
{ "errcode": 31, "errmsg": "授权失效" }
```

页面显示：`App 未返回页面参数` / `31: 授权失效`。

## 4. H5 侧约定

```ts
// 页面自己声明返回类型
interface BluetoothAiTranslateParams {
  uuid: string
  'access-token': string
}

// 名字列表与上面的接口保持同步
const WANTED_PARAMS: readonly (keyof BluetoothAiTranslateParams)[] = ['uuid', 'access-token']

const outcome = await fetchPageParams<BluetoothAiTranslateParams>(source, route.path, WANTED_PARAMS)
// outcome.status: 'ok' | 'unsupported' | 'failed'
```

- `fetchPageParams` 封装了「等 bridge 就绪 → 发请求 → 3 秒超时 → 判 `errcode`」，
  实现见 `apps/website/src/utils/page-params.ts`
- 不在 App 内（桌面浏览器）时 `isSupportBridge()` 为 `false`，直接返回 `unsupported`，不会发请求
- 页面只渲染 `data` 的第一层 key/value；新增字段只要把名字加进 `WANTED_PARAMS` 即可，无需改渲染

## 5. 新增页面 / 新增字段怎么做

1. **只新增字段**：把字段名加进该页面的 `WANTED_PARAMS`，Native 端在 `page` 对应的分支里补一个 key
2. **新增页面**：Native 端按 `page` 加分支即可，无需新增协议

`page` 是页面路径（`/settings/bluetooth-ai-translate-active`），不是完整 URL；
query 参数 H5 自己就能读到，不需要 Native 转发。

## 6. 待确认

- `data` 里的具体字段清单还没定（后端接口未出），当前页面只取 `uuid` / `access-token` 两个示例字段
- `errcode` 的业务码表需要 Native 补一份
- 蓝牙设备相关字段（蓝牙地址、设备名）后续由 Native 按实际蓝牙能力补进 `params`
