---
name: verify-vois-native
description: 'Verify the VOIS iOS native WebView pipeline on a physical iPhone: check the device and proxy prerequisites, drive the H5 page through the WebKit inspector, and prove bridge behavior with the debug capture. Use when the question is native-shell integration, the bridge contract on iOS, or runtime behavior in the installed app rather than the browser-only DevServer.'
---

# Verify the VOIS iOS native shell

The physical-iPhone companion to `verify-vois-webview`.

| Pipeline         | Skill                            | Answers                                                                                                                       |
| ---------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Browser / H5     | `.pi/skills/verify-vois-webview` | routes, UI, `/v2` calls, debug bridge inside the DevServer                                                                    |
| iOS native shell | this skill                       | what VoisChat's WKWebView actually exposes: `get-page-params`, `close-page`, permissions, location, clipboard, inspectability |

Use this skill when the answer depends on the native container. Use `verify-vois-webview` for everything that can be driven in a desktop browser. Neither replaces `vp check` / `vp test`; both prove behavior by agreement between the screen and the debug capture.

## Prerequisites

- macOS with Homebrew.
- iPhone with Developer Mode enabled, unlocked, paired and trusted.
- Web Inspector on the device: iOS 18 path is Settings > Apps > Safari > Advanced > Web Inspector.
- VoisChat installed as a **Debug build, dev-signed** (`get-task-allow`), with `WKWebView.isInspectable = true`. Release and App Store builds never expose a target.
- Restart the app after enabling Web Inspector. Inspectability is fixed when the WebView is created.
- Mac LAN IP must be `192.168.1.87`. The app's debug entry is hardcoded to `http://192.168.1.87:5173/#/`.
- A debug server on `:5173`: use the one already running, or `vp preview --host --port 5173 --debug` / `vp dev --host --port 5173`. Do not start a second server blindly; one capture file is shared per checkout.

Tools:

```sh
brew tap lycorp-jp/tap
brew install sim-use libimobiledevice ideviceinstaller ios-webkit-debug-proxy
```

## Steps

### 1. Check the device

```sh
idevice_id -l                                         # UDID; empty means not paired/trusted
idevicedevmodectl list                                # DeveloperMode must say enabled
sim-use ios-device devices --json                     # name, runtime, state
ideviceinstaller list -b com.voistech.wechat          # installed build
```

If the UDID is missing: unlock the phone, replug the cable, tap Trust, then `idevicepair pair`.

### 2. Start the WebKit proxy

```sh
ios_webkit_debug_proxy -u <UDID>
```

Keep it in its own terminal or pane. It assigns the device to port `9222`. Then list the targets:

```sh
curl -s http://127.0.0.1:9222/json/list | jq -r '.[] | [.type, .title, .url] | @tsv'
```

`type` must include a `page`. The scripts pick the first target's `webSocketDebuggerUrl` automatically; set `IOS_WEBVIEW_WS` to override.

### 3. Open the debug entry in the app

On the iPhone, launch VoisChat and reach the debug entry manually. The `sim-use` accessibility channel is unreliable on that control, so ask a human to tap it. The page must load `http://192.168.1.87:5173/#/` and log `WebView debug connected`.

If `/json/list` is empty, restart the app, return to an H5 page, and list again.

### 4. Drive the H5 page

```sh
node .pi/skills/verify-vois-native/scripts/eval-ios.mjs 'location.href'
node .pi/skills/verify-vois-native/scripts/eval-ios.mjs 'JSON.stringify({url: location.href, text: document.body.innerText.slice(0, 300)})'
node .pi/skills/verify-vois-native/scripts/eval-ios.mjs 'location.hash = "#/devices"'
```

Screenshots go through the inspector, not the accessibility channel:

```sh
node .pi/skills/verify-vois-native/scripts/send-ios.mjs Page.snapshotRect \
  '{"x":0,"y":0,"width":414,"height":812,"coordinateSystem":"Viewport"}' \
  --out apps/website/.tmp/verify/ios-native/device-list.png
```

The WebView viewport on this iPhone XR is 414x812 CSS px at device pixel ratio 2, so `width: 414, height: 812` saves 828x1624 pixels. Use `height: 896` for a full-screen 828x1792 capture. Without `--out` the script writes a timestamped file under `apps/website/.tmp/verify/ios-native/`.

## sim-use on a physical iPhone

| Capability | Command                                                    | Notes                                                  |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| AX tree    | `sim-use ios-device ui`                                    | Foreground app only                                    |
| Activate   | `sim-use ios-device tap '#BackButton'` or `--label '返回'` | `#id` is stable; labels can be dynamic                 |
| Screenshot | `sim-use ios-device screenshot --output <path>`            | Uses CoreDevice (`xcrun devicectl`), so it needs Xcode |

Limits that matter:

- The physical AX tree does **not** include WKWebView content. An H5 page shows only native chrome, usually `返回`; read H5 content through the inspector.
- There is no type, paste, swipe, gesture, or coordinate tap on physical iOS. The daemon exposes no element geometry. `type`, `paste`, `swipe`, `gesture` and `touch` target simulators/Android only.
- Activate is fire-and-forget and unreliable on some native controls. Ask a human when it fails.
- For H5 screenshots prefer `Page.snapshotRect`; `sim-use ios-device screenshot` captures the whole display but needs Xcode.

## The H5 inspector channel

`ios_webkit_debug_proxy` exposes a target layer even for a single page: commands are nested JSON sent with `Target.sendMessageToTarget`, and replies arrive as `Target.dispatchMessageFromTarget`. Attach to the target whose `targetInfo.type` is `"page"`, not `"frame"`. The scripts in `scripts/` implement this; keep the target-type filter if you write another client.

Examples:

```sh
# Read visible text
node .../eval-ios.mjs 'document.body.innerText.slice(0, 500)'

# Navigate the SPA the way native does, by hash
node .../eval-ios.mjs 'location.hash = "#/devices"'

# Click an element by JS
node .../eval-ios.mjs '[...document.querySelectorAll("button")].find((b) => b.textContent.includes("复制")).click()'

# Any WebKit inspector method
node .../send-ios.mjs Runtime.evaluate '{"expression":"1 + 1","returnByValue":true}'
```

JS events are not real touch events. `el.click()` and `location.hash` exercise the app's handlers, but gesture recognition, the soft keyboard, scroll inertia, and hit-testing are not covered. Mark those as manually checked or skipped.

## Evidence

The debug pipeline captures native bridge and network traffic at `apps/website/.tmp/vois-webview-debug/events.jsonl`, one JSON object per line. `bridge` events carry `direction` (`send` / `receive`), `protocol`, `data`, and `receivedAt` (epoch milliseconds).

```sh
# All bridge events, credential keys removed
jq -c 'select(.type=="bridge") | {receivedAt, direction, protocol, data: (.data | del(."access-token", .token, .sign, .appid))}' \
  apps/website/.tmp/vois-webview-debug/events.jsonl

# Only events after a known instant
jq -c --argjson since 1794205115000 'select(.receivedAt >= $since and .type=="bridge")' \
  apps/website/.tmp/vois-webview-debug/events.jsonl

# receivedAt is epoch ms; convert on macOS
date -r $((1794205115887 / 1000)) '+%Y-%m-%d %H:%M:%S'
```

Proof standards:

- **UI ↔ capture agreement.** The rendered device name or account must match the `responseBody` of the call that fed it. A screenshot alone is not proof.
- **Judge a reply by `errcode`, not HTTP status.** A `200` can still carry `errcode: 1`. iOS 5.0.6 answers unknown bridge actions with `{"success":false,"message":"Unknown action"}`, which has no `errcode` at all; record that shape as observed rather than treating it as success.
- Save artifacts under `apps/website/.tmp/verify/<feature-id>/` (gitignored). Name them with the run and entry point.
- Never print tokens, passwords, or auth URLs. Bridge logs redact `access-token` as `[redacted]`, but network event URLs can still contain `token=`, `sign=`, and `appid=`; strip them before printing.
- Read-only by default. Any write hits the real backend and possibly real hardware; observe the request and the UI state instead of mutating production data.

## Known iOS 5.0.6 findings

| Protocol          | Result                                                 |
| ----------------- | ------------------------------------------------------ |
| `get-page-params` | ✅ returns `theme`, `lang`, `login-id`, `access-token` |
| `close-page`      | ✅ native page closes after the send                   |
| `get-permissions` | ❌ `{"success":false,"message":"Unknown action"}`      |
| `get-location`    | ❌ same                                                |
| `write-clipboard` | ❌ same                                                |

The page params are missing `device-type`, `pkg-name`, `wxpay-appid`, and `pay-method`. Full evidence and timestamps: `docs/native/ios/runtime-2026-11-09.md`.

## Troubleshooting

- **Empty target list.** Did the app restart after Web Inspector was enabled? Is an H5 page open (a native-only screen has no target)? Is this a Debug build with `WKWebView.isInspectable = true`? Does Safari's Develop menu see the device? Check the proxy UDID too.
- **Device not found.** Unlock, replug, trust; `idevicepair pair`; confirm Developer Mode survived the last reboot.
- **Proxy port conflict.** Another proxy or Chrome debug instance may own `9222`. Stop only the proxy you started, or run `ios_webkit_debug_proxy -u <UDID>:9223` and set `IOS_WEBVIEW_WS=ws://127.0.0.1:9223/devtools/page/1`.
- **Script timeout.** The page may have navigated or closed, so no `Target.targetCreated` arrived. Re-run `curl http://127.0.0.1:9222/json/list`, reopen the H5 page, and retry.
- **Blank screenshot.** Wait for the route's data calls, and pass the CSS viewport size, not the pixel size.

## Cleanup

- Stop the WebKit proxy this run started. Leave the user's servers and other proxies alone.
- Never run `pkill -f vite`; if you started a debug server only for this run, stop that pid.
- Do not uninstall the app, clear its data, or change its account.
- Keep `apps/website/.tmp/verify/**`; it holds the evidence and is gitignored.

## Helpers

| Helper                     | Invocation                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Evaluate JS in the H5 page | `node .pi/skills/verify-vois-native/scripts/eval-ios.mjs '<expression>'`                          |
| Any inspector method       | `node .pi/skills/verify-vois-native/scripts/send-ios.mjs <method> '<params-json>' [--out <path>]` |
| Browser / H5 pipeline      | `.pi/skills/verify-vois-webview/SKILL.md`                                                         |
| iOS runtime findings       | `docs/native/ios/runtime-2026-11-09.md`                                                           |
