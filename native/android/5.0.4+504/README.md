# Android 5.0.4+504

| Field           | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Artifact        | `android-5.0.4+504` (see `native/index.json`)                      |
| Package         | `vender/WL_V5.0.4_Code504_09181532.apk` (untracked)                |
| SHA-256         | `ecb1f2a64ad7629bb3bbdb74f6e34f1bc8050348eceb05164299a28a2b581edf` |
| `applicationId` | `com.voistech.chat`                                                |
| Version         | 5.0.4 (code 504)                                                   |
| Build           | flavor `baseCn`, type **debug**, build time `09181532`             |
| SDKs            | min 23, target/compile 35                                          |
| Server          | `https://api.voischat.cn`                                          |
| Analyzed        | 2026-10-13, jadx 1.5.6                                             |

This is a **debug** build: it contains the developer debug entry and enables
WebView remote debugging. Release packages are expected to differ only in those
gated surfaces — verify, do not assume.

## H5 contract at a glance

- Launch: `VoisWebActivity` loads one URL, optionally merging default page
  params into its query. Back press walks WebView history, then closes the page.
- Bridge: single handler `uniBridgeCall`, three types — `close-page`,
  `get-page-params`, `wechat-app-prepay` — over the `yy://` WVJB transport.
- Page params: `access-token`, `login-id`, `theme`, `lang`, `device-type`
  (`android`), `pkg-name`, `wxpay-appid`, `pay-method` (`wechat`).
- Production H5 base: `https://api.voischat.cn/vois-app-webview-next/` — this
  repository's deployment path.
- Bridge-less container: `GenericWebViewActivity` for third-party and static
  pages; no page params, no handlers.

## Docs

| Doc                                          | Content                                                             |
| -------------------------------------------- | ------------------------------------------------------------------- |
| [webview-container.md](webview-container.md) | activities, settings, UA, compat gate, file chooser, error handling |
| [bridge-protocol.md](bridge-protocol.md)     | `yy://` transport, `uniBridgeCall` envelope, dispatch types         |
| [page-params.md](page-params.md)             | the param pool, sources, filtering, URL merging                     |
| [entry-points.md](entry-points.md)           | every native → H5 launch with its query params                      |
| [wechat-pay.md](wechat-pay.md)               | `wechat-app-prepay` request/response and ordering rules             |
| [scan-routing.md](scan-routing.md)           | QR payloads and which ones open the H5                              |
| [inventory.json](inventory.json)             | machine-readable contract, diff across versions                     |
| [evidence.md](evidence.md)                   | per-claim provenance, confidence, open questions                    |

## Class map

| Pointer                                               | Role                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| `com.voistech.chat.ui.web.VoisWebActivity`            | bridged H5 activity, bridge registration, param pool merge |
| `com.voistech.chat.ui.web.BaseWebView`                | WebView/compat gate/settings/UA/file chooser               |
| `com.voistech.chat.ui.web.GenericWebViewActivity`     | bridge-less WebView activity                               |
| `com.voistech.chat.ui.web.bridge.*`                   | `BridgeType`, dispatch contract, response envelope         |
| `com.voistech.chat.ui.web.WechatPayHelper`            | `wechat-app-prepay` handler and pay response fan-out       |
| `com.github.lzyzsd.jsbridge.*`                        | WVJB transport (`yy://`), injected JS, message model       |
| `com.voistech.chat.ui.base.VoisActivity`              | page param pool, theme/language mapping, token accessors   |
| `com.voistech.chat.config.UrlConstant`                | H5 base and route constants                                |
| `com.voistech.chat.ui.scan.ScanRouter` / `ScanHelper` | scanned payload classification                             |
| `com.voistech.chat.ui.config.ConfigManager`           | persisted `login-id`, language, theme mode                 |

## Known unknowns

- Release-build values for the surfaces gated on `BuildConfig.DEBUG`
  (debug entry, WebView remote debugging) are unverified.
- `SUB_HARDWARE_GROUP_SETTING_URL` points at a developer host in this build; the
  release value is unknown.
- Nothing here is runtime-verified: no device or emulator run has been recorded
  for this artifact.
- iOS behavior is documented separately and is not yet verified from an IPA —
  see `native/ios/README.md`.
