# Playwright feature suite

Repeatable proof for the mapped webview features. It drives a fresh desktop Chromium context against the DevServer's debug account and asserts the screen against the same capture the manual skill reads.

## Run

```sh
vp run verify:web
pnpm exec playwright test --config .pi/skills/verify-vois-webview/playwright/playwright.config.ts specs/device-list.verify.ts
```

Start the DevServer first (`cd apps/website && vp dev --host --port 3021`) and check it with the skill's doctor. The suite attaches to it and never starts a server, because one capture file belongs to one server session.

## Prerequisites

- `~/.vois/.env` with `VITE_APP_ID` / `VITE_APP_KEY`.
- The debug plugin resolved in the DevServer, so a page logs `🟢 WebView debug connected`.
- Google Chrome, or `PLAYWRIGHT_CHANNEL=chromium` after `pnpm exec playwright install chromium`.
- `vp install` once per worktree.

## How it works

- `playwright.config.ts` sets 375x812, DPR 2, `zh-CN`, one worker, and no parallelism.
- `fixtures.ts` opens the capture before a page loads and checks `sessionStartedAt` on teardown.
- `debug.ts` probes `/__debug/status` and reads `apps/website/.tmp/vois-webview-debug/events.jsonl` with the MCP package's parser, agreement, and redaction helpers.
- `api.ts` parses `manager-get-all-device` and `device-get-detail` bodies.
- `evidence.ts` writes `apps/website/.tmp/verify/<feature-id>/`.
- Auth is automatic: a fresh desktop context reads `/__vois-bridge/access-token`. Never use a mobile device descriptor; `isAndroid()` / `isIOS()` take the native path and time out.

## Add a spec

1. Create `specs/<feature>.verify.ts` with `test.use({ featureId: '<feature>' })`.
2. Take `capture.mark()` before `page.goto`, then wait for the call that feeds the screen with `capture.waitForNetwork`.
3. Parse the captured body with `api.ts` helpers and derive every expectation from it, never from a fixed name or count.
4. Assert the rendered state, then the side effect. A DOM-only change is not proof.
5. Write the artifacts the feature file names with `evidence.screenshot`, `evidence.aria`, and `evidence.json`.
6. Keep it read-only. Never click 提交, 报告, 确定, or 支付; cancel dialogs with 取消.
7. Run it, then break one assertion deliberately and confirm the spec fails. A spec that cannot fail proves nothing.

## Known constraints

- One worker: the capture is a single append-only file.
- The page title is a header button, not a heading. Scope duplicated names (`登录`, `报告`) with `exact: true` or `main`.
- `device-get-detail` is authoritative for capability flags; `manager-get-all-device` can disagree.
- The list's `nick` is the account's `wl...` name; the detail heading renders it.
- Traces are off by default. `VERIFY_TRACE=1` writes a local trace that can contain credentials; never cite it as evidence.
