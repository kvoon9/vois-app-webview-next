# iOS — expectations and gaps

There is **no verified iOS artifact** in this repository yet. Everything below is
inferred from the H5 package `@vois/webview-bridge@0.5.1` (which presumably
mirrors a working implementation) and must be confirmed against a real `.ipa`
before any claim here is treated as observed.

## What the H5 side expects (inferred)

| Aspect            | Android (observed)                                     | iOS (expected, unverified)                                                               |
| ----------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Transport         | `yy://` WVJB, `window.WebViewJavascriptBridge`         | `window.webkit.messageHandlers.uniBridgeCall.postMessage(...)`, no ready event → polling |
| Handler name      | `uniBridgeCall`                                        | `uniBridgeCall`                                                                          |
| Request payload   | `JSON.stringify({ type, data })` through `callHandler` | `JSON.stringify({ type, data, callbackName? })`                                          |
| Response delivery | WVJB `responseData` string via callback                | native calls `window[callbackName](jsonString)`                                          |
| Callback naming   | WVJB `callbackId`                                      | `bridge_callback_<sanitized type>_<seq>` (identifier-safe, unique per request)           |
| Envelope          | `{ type, errcode, errmsg, data }`                      | same envelope assumed                                                                    |
| Page params       | 8 keys (see `android/*/page-params.md`)                | same keys expected; `device-type` value unknown (`ios`?)                                 |
| `close-page`      | answers then finishes                                  | expected to dismiss the web view controller                                              |

The H5 gates iOS detection on the UA pattern
`/\(i[^;]+;( U;)? CPU.+Mac OS X/` and waits for
`window.webkit.messageHandlers.uniBridgeCall.postMessage` to appear.

## To verify on an IPA

1. Identify the WebView host controller and its bridge script; record the
   injected handler names and whether a readiness event exists.
2. Enumerate dispatch types (`close-page`, `get-page-params`, `wechat-app-prebay`
   equivalent, others) and the exact response envelope, including error strings.
3. Record the page-param pool and the `device-type` value, plus how theme/lang
   map on iOS.
4. Record the launch surface: URL scheme handling, per-route query params, and
   whether page params are merged into the launch URL.
5. Record payment: WeChat app pay parameters and deferred-response behavior.
6. Compare against this repo's H5 assumptions (`@vois/webview-bridge`,
   `usePageParams`, `usePageBack`) and open a follow-up for every divergence.

Create `native/ios/<versionName>+<buildNumber>/` with the same topic docs and
`inventory.json` shape as Android so the two platforms stay diffable, then add
the artifact to `native/index.json`.
