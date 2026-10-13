---
title: 'Overview'
description: 'iOS 5.0.3+1 reconnaissance pass: container, entry points, payment approach; bridge keys not yet read.'
---

# iOS 5.0.3+1 (first pass)

| Field       | Value                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Artifact    | `ios-5.0.3+1` (see `docs/native/index.json`)                                                                                   |
| Package     | `vender/VoisChat 2026-10-13, 11.40.xcarchive` (untracked)                                                                 |
| Bundle id   | `com.voistech.wechat`                                                                                                     |
| Version     | 5.0.3 (build 1)                                                                                                           |
| Minimum iOS | 16.0, `iphoneos` (arm64), Xcode 24A430 / SDK 27.0                                                                         |
| Main binary | `Products/Applications/VoisChat.app/VoisChat`, SHA-256 `9fa6afe7658e30e918873cf8cbf75262abf57f299106169c3a997c0fc3589e54` |
| Symbols     | main binary is stripped; `dSYMs/VoisChat.app.dSYM` carries the Swift symbols used below                                   |
| Analyzed    | 2026-10-13 (symbol and string-literal pass only)                                                                          |

**Status: reconnaissance.** The container, entry points and payment approach are
identified; the bridge payload keys are not yet read out of the code (see
[Open items](#open-items)). Nothing here is runtime-verified.

## What is verified

### Container (from dSYM symbols)

| Symbol                                                                             | Role                                                                                                                                   |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `VoisChat.JSWebView`                                                               | SwiftUI `UIViewRepresentable` hosting the bridged `WKWebView`                                                                          |
| `JSWebView.Coordinator`                                                            | `WKScriptMessageHandler`; `userContentController(_:didReceive:)` dispatches, `handlePageParams(webView:callback:)` answers page params |
| `VoisChat.CommonJSWebView`                                                         | bridged page wrapper (title bar, progress, Apple payment state)                                                                        |
| `VoisChat.CommonWebView`, `VoisChat.WebView`, `VoisChat.WebViewNavigationDelegate` | unbridged/plain web views and navigation handling                                                                                      |
| `VoisChat.ApplePaymentManager`, `VoisChat.AppleIapOrderModel`                      | Apple IAP (subscriptions) instead of Android's WeChat app pay                                                                          |

`handlePageParams` reads its values through `WLSDK.framework`
(`_OBJC_CLASS_$_WLSDK`), i.e. the same account/token source the App itself uses —
matching the Android design where `access-token` is the IM account token.

### Entry points (string literals in the main binary)

| Path                                                                                  | Note                              |
| ------------------------------------------------------------------------------------- | --------------------------------- |
| `https://api.voischat.cn/vois-app-webview-next/#/devices/groups/?`                    | trailing `?`: params are appended |
| `https://api.voischat.cn/vois-app-webview-next/#/report-group?`                       |                                   |
| `https://api.voischat.cn/vois-app-webview-next/#/report-user?`                        |                                   |
| `https://api.voischat.cn/vois-app-webview-next/#/settings/friends/multi-translation?` |                                   |
| `https://api.voischat.cn/vois-app-webview-next/`                                      | base                              |
| `https://api.voischat.cn/idverify/`                                                   | non-SPA                           |
| `https://api.voischat.cn/common/ios-next/personal/license/`, `…/privacy/`             | iOS-specific, unbridged           |
| `https://www.voischat.cn`, `https://m.aliyun.com`, `https://shop107342819.taobao.com` | external                          |

The route set is narrower than Android's (no `#/help`, no `#/settings` root in
this build).

### App-level facts that affect the H5

- `NSAppTransportSecurity.NSAllowsArbitraryLoads = true` — cleartext HTTP is
  allowed, so a page can load from an `http://` origin.
- `CFBundleURLTypes` only carries third-party login schemes (Weibo, QQ, WeChat);
  there is no own-scheme deep link. `application:openURL:options:` and
  `continueUserActivity:restorationHandler:` exist for those SDK callbacks.
- `LSApplicationQueriesSchemes`: `taobao`, `baidumap`, `iosamap` (external map
  app handoff) — different from Android, where navigation never leaves the
  WebView.

## Open items

1. **Bridge payload keys.** `uniBridgeCall`, `get-page-params`, `close-page`,
   `access-token`, `device-type`, … are all ≤ 15 bytes, so Swift stores them as
   inline small strings rather than data; `strings` and raw byte scans do not
   find them. Reading them needs disassembly of `Coordinator.userContentController`
   and `handlePageParams` (Hopper via REA, or a targeted `llvm-objdump` pass).
2. **Handler name and readiness model.** The H5 package expects
   `window.webkit.messageHandlers.uniBridgeCall`; confirm the registered name and
   whether a readiness signal exists (the H5 side polls, implying none).
3. **`device-type` value and the Apple-payment bridge type.** Unknown until (1).
4. **Response envelope and error strings** on iOS.
5. **Release vs this build** — the artifact is a device archive from a developer
   machine; shipping builds may differ in URLs.
6. **Runtime behaviour** — untested; no simulator run recorded.

## Next steps

- Set `HOPPER_LAUNCHER_PATH` (already in `.pi/mcp.json`) and open the main binary
  with REA's native tools (`open_binary` → `binary_overview` → `analyze_function`
  on the `userContentController`/`handlePageParams` addresses) to read the
  dispatch keys and page-param mapping; record them here and in `inventory.json`.
- Mirror the Android document set (`webview-container.md`, `bridge-protocol.md`,
  `page-params.md`, `entry-points.md`, `payment.md`, `inventory.json`,
  `evidence.md`) once the payload is known.
