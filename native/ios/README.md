# iOS

Native iOS (VoisChat) side of the H5 contract. Platform checklist mirrors
`android/README.md`; verified artifacts live in version directories below.

| Version                        | Status                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| [`5.0.3+1`](5.0.3+1/README.md) | reconnaissance: container, entry points, payment approach; bridge keys not yet read |

## Tools

- `dSYMs/<target>.app.dSYM` from the archive: symbols are stripped from the app
  binary but the dSYM still names every Swift type and method. Read them with
  `nm -a <dSYM>/Contents/Resources/DWARF/<binary> | awk '{print $3}' | xcrun swift-demangle`.
- `xcrun llvm-objdump --macho --disassemble <binary>` for raw code, `otool -oV`
  for ObjC class/method lists, `plutil -p Info.plist` for bundle facts.
- REA native analysis with the Hopper provider (see the local setup section in
  `native/README.md`) for pseudocode; the free Hopper demo is enough.

## Checklist for a new archive (`*.xcarchive` or `*.ipa`)

1. **Identity** — `Products/Applications/<App>.app/Info.plist`: bundle id,
   `CFBundleShortVersionString`, `CFBundleVersion`, `MinimumOSVersion`, ATS and
   URL scheme entries.
2. **Symbol map** — demangle the dSYM and list the web-related types
   (`grep -E "JSWebView|WebView|Payment"`); that is the fastest way to find the
   container before any decompilation.
3. **Entry points** — `strings` the app binary for the H5 base and `#/` routes
   (unlike short payload keys, URLs are long enough to be stored as data).
4. **Bridge dispatch** — decompile `…Coordinator.userContentController(_:didReceive:)`
   and `…handlePageParams(webView:callback:)`; short keys are inline Swift small
   strings, so they only exist in the instruction stream.
5. **Page params** — record keys, sources (typically `WLSDK`), the `device-type`
   value and error envelopes.
6. **Payment** — this line of builds uses `ApplePaymentManager` (Apple IAP), not
   WeChat app pay; record the bridge type and state machine.
7. **Navigation** — `WebViewNavigationDelegate` decides what stays in the WebView
   versus what the system opens; compare with Android's "never leave the WebView".

## Expected contract (from the H5 package, still partly unverified)

| Aspect      | Expectation                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------- |
| Channel     | `window.webkit.messageHandlers.uniBridgeCall.postMessage(...)`, no ready event → H5 polls   |
| Request     | `{ type, data, callbackName? }` where `callbackName` is an identifier-safe name             |
| Response    | native calls `window[callbackName](jsonString)`; envelope `{ type, errcode, errmsg, data }` |
| Types       | `close-page`, `get-page-params`, plus an Apple-payment type                                 |
| Page params | same keys as Android, `device-type` value unknown (`ios`?)                                  |

Update the table as soon as an artifact confirms or contradicts each row, and
record the evidence location next to the claim.
