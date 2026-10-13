# Bridge protocol — `uniBridgeCall`

Provenance: `com.voistech.chat.ui.web.bridge.*`, `com.voistech.chat.ui.web.VoisWebActivity`,
`com.github.lzyzsd.jsbridge.*` in artifact `android-5.0.4+504`. Everything here is
observed from the package unless marked otherwise.

## Transport: WVJB over `yy://`

The App uses the `lzyzsd/jsbridge` WebViewJavascriptBridge (WVJB). Its client
script ships inside the package as `assets/WebViewJavascriptBridge.js` and is
injected on **every** `onPageFinished`, i.e. after the document has loaded — a
page can never assume the bridge exists at parse time.

The injected script:

- defines `window.WebViewJavascriptBridge` (`init`, `send`, `registerHandler`,
  `callHandler`, `_fetchQueue`, `_handleMessageFromNative`) and dispatches a
  `WebViewJavascriptBridgeReady` event on `document`;
- returns early when `window.WebViewJavascriptBridge` already exists, and
  `init()` throws if called twice — initialize at most once per injection;
- creates two hidden iframes (`messagingIframe`, `bizMessagingIframe`) that carry
  the transport URLs.

Request/response round trip (H5 → native → H5):

1. H5 calls `WebViewJavascriptBridge.callHandler('uniBridgeCall', payload, callback)`
   with `payload` = `JSON.stringify({ type, data })`.
2. WVJB queues the message and points `messagingIframe.src` at
   `yy://__QUEUE_MESSAGE__/`.
3. Native `shouldOverrideUrlLoading` percent-decodes the URL, sees the `yy://`
   prefix and calls `flushMessageQueue()`; nothing is navigated.
4. Native runs `javascript:WebViewJavascriptBridge._fetchQueue();`.
5. JS answers with `bizMessagingIframe.src = "yy://return/_fetchQueue/<encodeURIComponent(JSON array)>"`
   — the native side reads the JSON array out of that URL. An empty queue
   navigates nothing.
6. Each queued message is `{ handlerName, data, callbackId }`; native dispatches
   on `handlerName` (only `uniBridgeCall` is registered).
7. The handler answers through `CallBackFunction#onCallBack(json)`, which native
   sends back as `{ responseId: <callbackId>, responseData: <json> }` via
   `javascript:WebViewJavascriptBridge._handleMessageFromNative('<escaped>')`
   (`loadUrl`, or `evaluateJavascript` once the command reaches 2 MiB).
8. WVJB resolves the JS callback with the **raw string** `responseData`; the H5
   layer does its own `JSON.parse`.

Consequences worth keeping in mind:

- Payloads ride inside URLs and JS string literals, so they must survive percent
  encoding and JS escaping. Native percent-**decodes** before matching, so a
  payload containing encoded `yy://` sequences cannot be used to fake a message,
  but unusual characters (quotes, `%7B`) are normal.
- Native → JS push (`send`) exists in the transport but the App registers **no**
  JS handlers and no default handler, so a `send` from the H5 side is dropped.
  Only `callHandler`-style request/response is useful.
- Only one native handler name exists. New features extend `type`, never the
  handler name (H5 `@vois/webview-bridge` depends on that).

## Envelope

Request as the native handler parses it (a JSON string):

```json
{ "type": "get-page-params", "data": { "params": ["login-id"] } }
```

Response as the H5 callback receives it (a JSON string):

```json
{ "type": "get-page-params", "errcode": 0, "errmsg": "", "data": { "login-id": "441" } }
```

Rules:

- All four fields are always present in a response. `data` is `{}` when the
  handler has none; `errcode` is an integer, `0` on success and `-1` on failure.
- `errmsg` carries the failure text. Framework strings observed:
  `Missing type field`, `Unsupported type: <type>`, `Handler exception: <message>`.
  A request with no callback function is answered with silence.
- `data` must be a JSON **object** when present; a non-object `data` raises a
  handler exception. Absent or `null` `data` becomes `{}`.
- One answer per request, always through the callback — no events, no
  unsolicited pushes.

## Dispatch types

| `type`              | request `data`                                                 | response `data`                | side effect                         |
| ------------------- | -------------------------------------------------------------- | ------------------------------ | ----------------------------------- |
| `close-page`        | ignored                                                        | `{}`                           | answers, then finishes the activity |
| `get-page-params`   | `{ params?: string[] }`                                        | requested keys → string values | none                                |
| `wechat-app-prepay` | `{ partnerid, prepayid, noncestr, timestamp, sign, extdata? }` | payment result fields          | hands the request to WeChat         |

`close-page` is the only type with a visible side effect and it answers _before_
closing, so the H5 can rely on the reply arriving. Back-press closing is a
separate path: it walks WebView history and then finishes the activity without
touching the bridge — the App does not send any "page closed" notification.

`get-page-params` details live in [page-params.md](page-params.md),
`wechat-app-prepay` in [wechat-pay.md](wechat-pay.md).

## Compatibility notes for the H5 side

- Injection is late and silent: wait for `window.WebViewJavascriptBridge` or the
  `WebViewJavascriptBridgeReady` event, then `init()` once. There is no timeout
  signal from native, so a page that never injects stays pending forever.
- Android-only in this artifact. iOS is expected to expose the same `type`
  values through `webkit.messageHandlers.uniBridgeCall` with a `callbackName`
  field instead of WVJB — see `native/ios/README.md` (inferred from the H5
  package, unverified).
- The bridge lives on the current document. SPA navigation does not re-inject
  the script, and the native side keeps no per-route state: `get-page-params`
  reads app-wide values on demand.
