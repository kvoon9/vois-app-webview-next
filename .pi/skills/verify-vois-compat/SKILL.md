---
name: verify-vois-compat
description: 'Run the three-layer compatibility suite for the VOIS WebView app: fast checks, a real desktop Chromium sweep at the Chrome 70 support target, and physical iOS/Android device runs. Use when changing the build target, polyfills, legacy syntax, or when a release needs the old-engine floor proven.'
---

# Verify VOIS compatibility

The app ships to old Android WebViews, so compatibility is proven in three layers. Each layer answers a different question, and a pass in one is not a pass in another.

| Layer | Entry point            | Engine                        | Bridge                    | Evidence                                           |
| ----- | ---------------------- | ----------------------------- | ------------------------- | -------------------------------------------------- |
| L1    | `vp run verify:fast`   | Node (no DOM)                 | real seams / fakes        | none, CI repeats it on every PR                    |
| L2    | `vp run verify:legacy` | desktop Chromium 70           | debug server, fake bridge | `apps/website/.tmp/verify/compat/legacy/<target>/` |
| L3    | `vp run verify:device` | real iPhone / Android WebView | real native bridge        | `apps/website/.tmp/verify/compat/device/`          |

Boundaries, stated once so nobody overclaims:

- Production supports **Chrome 70**. `apps/website/vite.config.ts` defaults to `chrome 70`; `VOIS_CHROME_TARGET` exists only to re-measure the floor.
- The measured floor is **Chrome 64**. The optional `--target 64` sweep is the lower bound.
- **63 is known-blocked** by the `\p{Emoji}` regex in `polyfills-legacy`, which the 63 engine cannot parse. Do not claim 63.
- L2 is a real rendering engine plus the debug server's fake bridge. It proves the bundle, not native.
- L3 is a real engine plus the real native bridge. It is the only layer that can prove `get-page-params`, `close-page`, permissions, location, and payment.
- CI runs L1 only. L2 and L3 are run locally before a release or when the target, polyfills, or legacy syntax change.

## L1 fast

```sh
vp run verify:fast
```

This is `vp check && vp test`. `vp check` owns format, lint, and type checking; `vp test` owns the unit and model tests. Exit status is the gate, never tail output through a pipe.

The model-shaped tests from PR #24 are the reference for what belongs here. They assert observable contracts, not internals: `apps/website/src/utils/bridge/contract-matrix.test.ts` walks protocol against reply shape (success, native error, unknown action, invalid JSON, timeout), `apps/website/src/utils/device-api.test.ts` pins the API surface, and composables such as `usePageBack`, `usePageParams`, `useAccountId`, and `useNavigationContext` have their own contract tests. Add a cell to the matrix rather than a bespoke mock when a bridge behavior changes.

Before deciding a behavior is covered, read `.pi/skills/verify-vois-webview/features/README.md`. L1 cannot see a click, a route, a real `/v2` response, or a bridge handshake, so those move to L2 or the feature skill. A mapped feature with a Playwright spec is proven there with `vp run verify:web`; L2 still owns the Chrome 70 bundle proof and is not a feature substitute.

## L2 legacy sweep

```sh
vp run --no-cache verify:legacy                  # builds for chrome 70, sweeps it
vp run --no-cache verify:legacy -- --target 64   # measured floor, optional experiment
vp run --no-cache verify:legacy -- --skip-build  # reuse the existing dist
vp run --no-cache verify:legacy -- --reuse-preview
```

`--no-cache` is required on arm64 macOS. Vite Task's file-access tracer injects an arm64 `fspy` dylib, and the cached Chromium 70 snapshot is x86_64, so a traced run kills the browser before it starts. The script detects that combination and exits 2 with the command to rerun. The flag also keeps a verification gate from replaying a stale success. On an Intel host or where the tracer is inactive, `vp run verify:legacy` reaches the same script.

The script runs these steps and fails on the first unmet one.

1. Build `apps/website` with `VOIS_CHROME_TARGET=chrome <target>` through `vp run --no-cache website#build`. `tsc` runs first, and the no-cache run stops a cached build from replaying across targets.
2. Read the built `dist/index.html` entry scripts and assert their chunks contain no `??` or `?.`. Vite+ leaves JS syntax alone, so the `vois-downlevel-chunks` plugin in `apps/website/vite.config.ts` is what makes this pass.
3. Resolve desktop Chromium for the target. The cache is `~/.vois/tools/chrome-sweep/browsers/<major>` and is reused without network; set `CHROME_SWEEP_ROOT` to move it. A cold cache downloads a macOS x64 Chromium snapshot from `chromium-browser-snapshots` and unzips it under that path.
4. Reuse a debug preview already answering on `http://127.0.0.1:8081`, or start `vp preview --host --port 8081 --debug` from `apps/website` and wait for `/__debug/status`. Production artifact, so `preview:production` behavior is what is tested.
5. Drive `http://127.0.0.1:8081/?capture=bridge#/devices` over CDP with `--lang=zh-CN`, a 375x812 viewport at DPR 2, and `WAIT_MS` (default 30000) as the deadline. The wait polls, so a fast render finishes early.
6. Read the bridge capture after the page settles and record its count, protocol/direction summary, and timeline in `results.json`.
7. Capture `results.json`, `run.json`, `<target>.png`, `<target>.chrome.log`, and `preview.log` under `apps/website/.tmp/verify/compat/legacy/<target>/`.

The data-row predicate is `wl\d{6,}|CF03|电量|Battery` over the rendered body text. It is intentionally stricter than "the app mounted": it only matches when a device row or its battery reading exists.

### Capture mode

L2 selects the bridge capture with `?capture=bridge`. That client parses on Chrome 70 and records only `bridge` events plus one `lifecycle` load marker, and it still logs `🟢 WebView debug connected`. The query is read in the page, so the injected script tag stays exactly `/__debug/client.js`; a page without the query runs the plugin's full client unchanged, and that full capture remains the default for web and native proof.

Console and network evidence for L2 comes from CDP, which the sweep already enables: `Runtime.exceptionThrown` / `Log.entryAdded` for errors and `Network.responseReceived` / `Network.loadingFailed` for requests. Lifecycle is the sweep's own navigation and poll. A `/__debug/client.js` exception is now an app failure instead of filtered harness noise. `checks.bridgeMode` proves the page took the bridge branch (`window.__voisDebugCapture`), and `checks.bridgeCaptured` proves the capture received at least one bridge event after navigation.

### Acceptance predicates

A row passes only when all of these are true, and the script records each one in `checks`:

- `uaMatches` reports `Chrome/<target>.`.
- `appRoot` finds `#app`.
- `noErrorPage` is true, meaning the body does not contain `出了点问题`.
- `debugClient` finds the injected `/__debug/client.js` script tag.
- `bridgeMode` is true, meaning the page selected the bridge capture.
- `bridgeCaptured` is true, meaning at least one bridge event arrived after navigation.
- `dataRow` matches the strong predicate above.
- `noAppExceptions` and `noAppAssetFailures` are true. Asset 404s on the app origin are failures; `net::ERR_ABORTED` and favicon misses are not.
- `headingVisible`, `listRows > 0`, and `buttons > 0`.
- `noHorizontalOverflow` is true at 375x812.

Overlap is not measurable from the DOM, so inspect `<target>.png` after a pass. When a change touches layout geometry, also capture the 320x568 edge as the repo's vision rule says; the sweep itself is fixed at 375x812.

## L3 physical device

```sh
vp run verify:device           # doctor + runbook, exits 1 when no debug server answers
vp run verify:device -- --json
```

The script is a doctor and checklist, not a phone driver. It checks `/__debug/status` on ports 3021, 5173, and 8081, summarizes `apps/website/.tmp/vois-webview-debug/events.jsonl` by event type and bridge protocol, reports non-zero `errcode`s, and prints both runbooks. Actual driving stays with the agent through the existing channels.

### iOS

Use `.pi/skills/verify-vois-native/SKILL.md` as the authority. The short path:

```sh
idevice_id -l
idevicedevmodectl list
ios_webkit_debug_proxy -u <UDID>
curl -s http://127.0.0.1:9222/json/list
node .pi/skills/verify-vois-native/scripts/eval-ios.mjs 'location.hash = "#/devices"'
node .pi/skills/verify-vois-native/scripts/send-ios.mjs Page.snapshotRect \
  '{"x":0,"y":0,"width":414,"height":812,"coordinateSystem":"Viewport"}' \
  --out apps/website/.tmp/verify/compat/device/ios/device-list.png
```

The debug entry is hardcoded to `http://192.168.1.87:5173/#/` and needs a debug server on `:5173`; append `?capture=bridge` for this layer. Read H5 content through the inspector, not the accessibility tree. In bridge mode the capture holds bridge events and one load marker, so enable the inspector's `Network` domain for request and response evidence. Judge bridge replies by `errcode`.

### Android

Use the existing AndroMeld MCP flow; there is no new Android suite. `docs/device-management-status.md:113` and `docs/device-management-verification.md` are the references.

1. `phone_connect` with the task name, then `phone_launch VoiChat`.
2. Drive 设备 tab, then a device row, then detail with `phone_observe` and `phone_tap`. The element tree's frame divided by `1.9216` equals CSS px.
3. Open the debug page with `?capture=bridge`. Read `apps/website/.tmp/vois-webview-debug/events.jsonl` for bridge events; network and console come from the inspector/CDP. Judge bridge replies by `errcode`, not HTTP status.
4. Writes (unbind, fence, reminder) only on a sacrificial test device, and restore it afterwards.
5. Native location, permission prompts, and payment need the real app. The DevServer has debug stubs only.

L3 accepts the same UI predicates as L2. The proof additionally requires **UI and capture agreement**: the rendered device name or account must match the `responseBody` of the call that fed it, or a bridge reply's `data` when the bridge supplied it. The MCP `agreement` tool checks a bridge reply or a captured network body and redacts credentials first; in bridge mode, where network lives in the inspector, compare the inspector's response with the screen. A screenshot alone is not proof.

## Evidence

Everything lands under `apps/website/.tmp/verify/compat/`, which is gitignored and machine-local. The legacy script stops the preview it started, never a reused one, and leaves the artifacts in place.

```text
apps/website/.tmp/verify/compat/
  legacy/70/results.json        # the row, checks, exceptions, network failures, bridge timeline, notes
  legacy/70/run.json            # build target, preview identity, syntax check, browser
  legacy/70/70.png              # 375x812 screenshot
  legacy/70/70.chrome.log       # browser stderr
  legacy/70/preview.log         # only when this run started the preview
  device/ios/…                  # screenshots and captures from verify-vois-native
  device/android/…              # screenshots and captures from the AndroMeld drive
```

`results.json` stores portable paths. Never copy `token`, `sign`, `appid`, `access-token`, or whole response bodies into an artifact.

## Cleanup

- The legacy script stops its own preview process group and browser. A reused preview is left alone.
- L3 stops only the proxy or app instance this run started. Never `pkill -f vite`.
- Keep `apps/website/.tmp/verify/**`. Cleanup removes processes and scratch state, never the proof.

## Helpers

| Helper                     | Invocation                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------- |
| Fast layer                 | `vp run verify:fast`                                                                |
| Legacy sweep               | `vp run --no-cache verify:legacy [-- --target 64] [--skip-build] [--reuse-preview]` |
| Device doctor and runbook  | `vp run verify:device [-- --json] [--port 3021]`                                    |
| Sweep only                 | `node .pi/skills/verify-vois-compat/scripts/sweep.mjs --milestones 70`              |
| Resolve/download a browser | `node .pi/skills/verify-vois-compat/scripts/resolve.mjs --milestones 70`            |
| WebView debug doctor       | `node .pi/skills/verify-vois-webview/scripts/doctor.mjs`                            |
| iOS inspector evaluation   | `node .pi/skills/verify-vois-native/scripts/eval-ios.mjs '<expression>'`            |
| iOS inspector method       | `node .pi/skills/verify-vois-native/scripts/send-ios.mjs <method> '<json>'`         |

## Troubleshooting

- **The browser dies with a `dyld` or `fspy` error.** Vite Task tracing injected an arm64 dylib into the x86_64 Chromium. Run the sweep with `vp run --no-cache verify:legacy`.
- **`preview exited` or port 8081 is busy.** Another preview owns the port. Stop the process you started earlier, or run the sweep after that preview exits. The script never kills an existing preview.
- **Browser download fails.** The first L2 run needs network access to `chromiumdash.appspot.com`, `chromium.googlesource.com`, and `storage.googleapis.com`. Later runs use the cache.
- **`entry syntax: FAIL`.** The build plugin did not downlevel every entry chunk. Check which file and syntax remain, then fix `vois-downlevel-chunks` rather than lowering the target.
- **`dataRow` is false while `appRoot` is true.** Auth or the API failed. Run `verify-vois-webview`'s doctor and inspect the capture; a 200 with `errcode: 1` is not a pass.
- **`bridgeCaptured` is false.** The page did not select bridge mode or produced no bridge traffic. Check the `?capture=bridge` query and `window.__voisDebugCapture` in the page.
- **A `/__debug/client.js` exception.** The served client no longer parses or runs on the target engine. Fix `apps/website/plugins/debug-client-bridge.js`; do not filter it.
- **Chrome 64 needs the AbortController polyfill.** It is already in `apps/website/src/polyfills.ts`; do not remove it while 64 remains the measured floor.
- **Chrome 63.** Do not run it. The `\p{Emoji}` regex in `polyfills-legacy` is a parse error on that engine.
