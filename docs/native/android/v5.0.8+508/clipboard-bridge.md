---
description: 'The clipboard bridge added in App build 10201402: `write-clipboard` / `read-clipboard` contract, the Android 13 sensitive flag, and how an older build answers.'
navigation:
  title: 'Clipboard bridge'
---

# Clipboard bridge: `write-clipboard` / `read-clipboard`

Provenance: `com.voistech.chat.ui.web.bridge.WebClipboardBridge`,
`BridgeResponseBuilder` and the handler registration in
`com.voistech.chat.ui.web.VoisWebActivity`, in artifact
`android-5.0.8+508-10201402` (`vender/WL_V5.0.8_Code508_10201402.apk`,
sha256 `cfc697901d1b07c7fc784102b879ee3b8d7963ea1bf9af6f67e28e1051e25830`,
build type debug, flavor baseCn). Decompiled with jadx 1.5.6. Only the classes
named here were inspected.

This is the one functional bridge change over build `10191150` in the classes
inspected: `BridgeType` gains `read-clipboard` and `write-clipboard` (that build
lists neither), and `VoisWebActivity.registerBridgeHandlers` registers both
against one `WebClipboardBridge`. The transport, the `close-page` /
`get-page-params` handlers and the dispatch error path are unchanged.

## Contract

### `write-clipboard`

Request `data`:

| field       | type      | meaning                                                             |
| ----------- | --------- | ------------------------------------------------------------------- |
| `text`      | `string`  | the text to put on the clipboard; empty or missing is an error       |
| `sensitive` | `boolean?`| mark the clip `IS_SENSITIVE`; Android 13+ only, older builds ignore it |

Success answers `errcode: 0` with an empty `data`:

```json
{ "type": "write-clipboard", "errcode": 0, "errmsg": "", "data": {} }
```

Two error paths, both `errcode: -1`:

```json
{ "type": "write-clipboard", "errcode": -1, "errmsg": "text is required", "data": {} }
{ "type": "write-clipboard", "errcode": -1, "errmsg": "clipboard unavailable", "data": {} }
```

The write is `ClipboardManager.setPrimaryClip(ClipData.newPlainText(null, text))`
on the **application** context, so it lands on the system clipboard with no
label. `sensitive` adds `android.content.extra.IS_SENSITIVE` to the clip
description on API 33+, which hides the content in the Android 13+ clipboard
preview. The response arrives before the H5 needs anything else: there is no
read-back and no confirmation step.

### `read-clipboard`

No request `data` is read. The answer carries the current clip's text:

```json
{ "type": "read-clipboard", "errcode": 0, "errmsg": "", "data": { "text": "861490079048881" } }
```

`data.text` is `''` (never absent) when the clipboard is unavailable, holds no
primary clip, or the first item coerces to nothing. The value is
`ClipData.Item.coerceToText(context)`, so a `content:` URI or an intent clip
answers its resolved text, not a URI string.

Platform note, not decompiled evidence: Android 10+ (API 29) refuses clipboard
reads to a background app, and `getPrimaryClip()` answers `null` there, which
this handler turns into `''`. A read is only meaningful while the App is
frontmost with the activity holding focus.

## Older builds and the error that means "not supported"

The dispatcher in `VoisWebActivity` (`uniBridgeCall`) looks the type up in
`jsBridgeHandlerMap` and, when it is absent, answers:

```json
{ "type": "write-clipboard", "errcode": -1, "errmsg": "Unsupported type: write-clipboard", "data": {} }
```

Build `10191150` has the same branch and no clipboard handler, so it answers
exactly that. **No capability probe is needed and no version check belongs in
the H5**: a build without the bridge says so, with the same `errcode: -1` a
refusal uses. The handler map also answers `-1` for a malformed body
(`json` not an object) and for a handler exception
(`"Handler exception: …"`).

## H5 side

`apps/website/src/utils/bridge/clipboard-bridge.ts` declares both protocols and
owns `copyToClipboard`, the one copy path every screen uses:
`write-clipboard` first, then `navigator.clipboard.writeText`, then a temporary
selection (`copyText` in `apps/website/src/utils/clipboard.ts`, which is also
where the ordering policy is tested).

Three decisions worth keeping:

- **The UA gates the native write** (`isAndroid() || isIOS()`), not
  `isSupportBridge()`. That answer is also `true` on a desktop page that
  imported the debug entry, and the debug server's bridge answers every type it
  does not implement with `errcode: 0`, a success it never performs. Gating on
  the UA keeps a desktop debug session on the real web paths, so its toast and
  paste evidence stay honest.
- **A silent bridge is bounded** (1 s). `whenWebviewBridge()` never settles when
  native stays quiet, and a copy must not hang waiting for it; on timeout the
  web paths take over.
- **Every native failure answers `false`**, never a throw: unsupported
  environment, missing bridge, timeout, rejected request, or `errcode` other
  than 0. The caller only needs to know whether the text reached a clipboard,
  because a web path is always still available.

`read-clipboard` is declared and typed but has no caller yet.
