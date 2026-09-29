# Bridge 与 token 获取

## Web 接口

业务页面只调用业务 API，HTTP 层统一读取 token：

```ts
import { bridge } from '~/utils/bridge'

const token = await bridge.getAccessToken()
```

`weilaFetch()` 和 `weilaUpload()` 都走这个入口。不需要在 `App.vue` 初始化 token，也不依赖组件生命周期或页面参数加载。

## 复用现有原生协议

`bridge.getAccessToken()` 是 Web 封装，内部继续调用已有的 `get-page-params`：

```ts
const response = await native.request('get-page-params', {
  page: currentRoutePath,
  params: ['access-token'],
})
```

原生响应保持原来的字段：

```json
{
  "errcode": 0,
  "errmsg": "",
  "data": { "access-token": "<current-token>" }
}
```

无需原生增加接口或修改 token 返回格式。原生继续负责登录会话与 token 刷新。

website 的 `usePageParams(['uuid'])` 只处理页面参数，自动附带 `theme`、`lang` 字段请求。它保留所有标量字段，包括 token，并保留正常的 query 优先级；不会写入认证状态、结束认证等待或触发登录。HTTP 认证仍直接读取原生 page params，不使用 query 中的 token。

两条 Web 调用链独立管理生命周期，但复用同一个原生协议：

```text
业务 API → bridge.getAccessToken() → get-page-params(['access-token'])
                                  ↳ 无可用 token → 仅 dev / debug preview 固定账号登录
页面参数 → usePageParams(['uuid']) → get-page-params(['theme', 'lang', 'uuid'])
```

## 生命周期

- 先尝试原生 page params，有有效 token 就立即返回，不调用固定账号登录。
- 缺失、空白、非法响应、原生错误、无可用 bridge 或超时都表示未取得可用 token。
- 仅 dev 和 debug preview 允许固定账号登录兜底；正式 WebView 直接报告原生读取错误。
- 同时发起的调用共享整个“原生读取 → 必要时登录”过程。
- 每次新读取记录当时的路由路径，等待就绪与原生响应合计最多 10 秒；兜底登录另有 15 秒网络时限。
- 成功或失败后清除共享 Promise，下一次调用仍然先尝试原生，恢复后的原生 token 优先。
- 不缓存原生 token，也不读取 URL 或浏览器存储中的 token。固定账号的成功登录会话由 debug 模块在内存中复用，失败后可重试。
- 失败由业务查询展示；用户重试查询时自然重新获取 token。
- 不自动重放已经发送的业务请求，避免重复执行激活或支付。

超时后才就绪的通道不会发出已经过期的请求。SDK 的 iOS 回调按请求独立分配，并在收到响应后删除，避免同一协议的并发请求、重试和迟到响应互相覆盖。原生按照现有契约调用请求携带的 `callbackName` 即可。

SDK 目前没有取消接口：Web 超时结束等待，不会撤销已送达原生的操作；未返回的 iOS 回调会保留到响应到达或页面销毁。

## 错误

`AppBridgeError.code` 区分原生读取的失败原因，`nativeCode` 保留原生错误码。允许兜底的环境先尝试登录；如果登录也失败，则将登录错误交给业务查询展示。

| code                      | 含义                     |
| ------------------------- | ------------------------ |
| `BRIDGE_UNAVAILABLE`      | 无原生或 debug 通道      |
| `BRIDGE_TIMEOUT`          | 等待就绪或响应超时       |
| `BRIDGE_INVALID_RESPONSE` | JSON 或响应字段格式错误  |
| `NATIVE_ERROR`            | 原生返回非零错误码       |
| `AUTH_REQUIRED`           | 成功响应中没有有效 token |

## Debug 与 SDK

直接修改 `~/weila/vois-webview-bridge`，不使用依赖补丁。开发时本地链接构建出的 SDK，正式使用这些 SDK 改进时发布新版并更新依赖。

Debug 继续模拟原来的 `get-page-params`，读取参数本身不触发登录，也不刻意过滤已提供的 token。`bridge.getAccessToken()` 取不到 token 时才调用 SDK 的 `getDebugAccessToken()`，复用 SDK 中已有的固定账号与登录实现。

dev 由 `import.meta.env.DEV` 识别，preview 由 `--debug` 服务注入的 script 标记识别（项目的 preview 脚本已开启）。正式部署没有该标记，不会启用固定账号兜底。调试镜像会脱敏 token 字段。

应用启动仅预热通道，使没有 HTTP 请求的页面也能发送关闭消息。页面关闭继续走 `usePageBack().goBack()`。

## 验收

- 保持原生协议名、请求结构与 `access-token` 返回字段不变。
- 并发 token 读取合并，下一次读取获取新值，失败后重试重新请求。
- 路由上下文正确，总超时覆盖就绪和响应阶段。
- 页面参数不写入认证状态，参数读取失败不结束 token 等待。
- 原生 token 优先；dev/preview 无 token 时才登录；生产不触发固定账号登录。
- `usePageParams` 保留 token 字段，参数读取本身不登录。
- 兜底登录合并并发、失败可重试、原生恢复后重新优先使用原生 token。
- iOS 同一协议的多个响应互不覆盖。
- 激活页重试及上传均通过同一 token 入口。
