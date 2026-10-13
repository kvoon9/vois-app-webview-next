---
description: 'Method and checklist for a new Android package: tools, the first classes to diff, debug-only surfaces.'
navigation: false
---

# Android reverse-engineering notes

The H5-facing surface of the Android App is small and stable: one WebView
activity, one JS bridge dispatch method, eight page params and a handful of
launch URLs. Everything below is about finding that surface quickly in a new
package.

## Tools

| Tool                                                                       | Use                                          | Notes                                                                                           |
| -------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `jadx`                                                                     | resource decode + dex decompilation          | `brew install jadx`; 1.5.6 used for 5.0.4                                                       |
| `docs/native/tools/extract.mjs`                                                 | verify SHA-256, decode into `.tmp/rev/<id>`  | regenerates everything below                                                                    |
| REA Android provider (`inspect_android_package`, `search_android_classes`) | structured class/method search with Evidence | optional: needs `REA_JADX_MCP_JAR` (jadx-headless-mcp 0.7.1) plus a JDK in the MCP server's env |
| `unzip -l`                                                                 | inventory of `lib/`, `assets/`               | assets carry the injected bridge JS                                                             |

`jadx` reports decompilation errors for some classes and still produces a
readable tree; treat the errors as normal and check `.tmp/rev/<id>/jadx-sources.log`.

## Checklist for a new package

1. **Identity** — `AndroidManifest.xml` (`package`, `versionCode`, `versionName`)
   and `BuildConfig.java` (`BUILD_TYPE`, `FLAVOR`, `SERVER_ADDRESS`, version
   constants). Record whether the package is a debug or release build; debug
   builds carry extra entries (see [Debug-only surfaces](#debug-only-surfaces)).
2. **Web container** — `com/voistech/chat/ui/web/`: `VoisWebActivity` (bridged)
   and `GenericWebViewActivity` (bridge-less). Re-check the layout in
   `res/layout/activity_session_web.xml` for `app:useBridge`.
3. **Bridge types** — `ui/web/bridge/BridgeType.java` lists every dispatch type.
   Diff this file first; it is the contract's front door.
4. **Page params** — `ui/base/VoisActivity#getWebApiDefaultQueryParams` plus
   `getWebThemeMode` / `getWebLang` / `convertToStandardLang`; the handler in
   `ui/web/VoisWebActivity#registerBridgeHandlers`.
5. **Entry points** — `config/UrlConstant.java` for the H5 base and route
   constants, then every `VoisWebActivity.WebParam.Builder()` call site for the
   per-route query params.
6. **Scan routing** — `ui/scan/ScanRouter.java` and `ScanHelper#parseCodeType`
   decide which scanned payloads become H5 pages.
7. **Payment** — `ui/web/WechatPayHelper.java` for `wechat-app-prepay`.
8. **Injected JS** — `assets/WebViewJavascriptBridge.js`; compare it against the
   previous version, since the H5 side (`@vois/webview-bridge`) matches on the
   `window.WebViewJavascriptBridge` shape and the `WebViewJavascriptBridgeReady`
   event.
9. **Native libs / other assets** — only when the task needs them; `lib/` is AMap,
   mmkv, opus, zxing and friends, not H5 contract.

## Debug-only surfaces

`BuildConfig.DEBUG == true` packages contain a profile "debug" entry
(`com.voistech.chat.ui.activity.DebugActivity`) whose single action opens
`VoisWebActivity` at a hard-coded dev H5 server. Release packages hide it
(`View.setVisibility(...)` gated on `BuildConfig.DEBUG`) and also disable
`WebView.setWebContentsDebuggingEnabled`. Do not assume a debug package's
hard-coded hosts exist in release.

## Recording results

- Add the entry to `docs/native/index.json` (SHA-256, size, identity) before writing
  any prose, so the docs can cite the artifact id.
- Copy the previous version's `inventory.json`, then reconcile it key by key;
  the diff is the review artifact.
- Fix the topic docs in place and note the change in that version's `README.md`.

## Traps

- **Build type**: this line of packages is `baseCn` flavor; `SERVER_ADDRESS`
  and `THIRD_ADDRESS` may point at different hosts per flavor.
- **Host constants**: some routes are plain web apps outside this repo
  (`web.weila.hk:9000/*`, `/taxi_manage/*`, `/idverify/`, license/privacy
  pages). Keep them in `entry-points.md` so the boundary of "our H5" stays
  explicit.
- **Hard-coded dev hosts**: a URL constant may still point at a developer
  machine; record the value as observed and mark the release value unknown.
- **Static ≠ runtime**: nothing here proves what a device does at runtime; use
  the WebView debug pipeline for runtime evidence.
