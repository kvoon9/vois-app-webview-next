---
name: verify-vois-webview
description: 'Drive the VOIS WebView app (apps/website) the way a user does and prove behavior with captured evidence: launch the DevServer, check the instance with doctor.mjs, drive it with ego-browser, and read the debug capture. Use when verifying UI, bridge, or API behavior in this repo, after a change under apps/website, or when asked whether a screen still works.'
---

# Verify the VOIS WebView

This skill drives the real app in a shared browser and proves what happened with the debug pipeline's own capture. `features/` is the maintained map of user-facing behavior: read `features/README.md` before driving, then the matching feature file as the recipe. Nothing here replaces `vp check` / `vp test`; it covers what unit tests cannot see — a click, a route, a bridge message, a `/v2` call.

There is no seeded fixture. The DevServer proxies `/v2` to the real backend signed in as the debug account, so the proof is **agreement between what the screen shows and what the captured response says**, not a hardcoded expected string.

## Launch

```sh
cd apps/website && vp dev --host --port 3021
```

- One `~/.vois/.env` serves every worktree (`VITE_APP_ID` / `VITE_APP_KEY` are build inputs; the DevServer needs them too). Missing file → copy `apps/website/.env.example`.
- Run it in a terminal that outlives the turn: with Herdr (`HERDR_ENV=1`), `herdr_layout pane_split` then `herdr_pane run`; otherwise a `bg_task` spawn. Do not block the turn on it.
- Ready is all three, in order: `➜  Local: http://localhost:3021/` in the pane → `curl -s http://127.0.0.1:3021/__debug/status` returns JSON → a page load logs `🟢 WebView debug connected`. The third one is the real gate; without it you have a website, not an instrumented WebView. If the marker is missing on a live server, reload the page with `?debug-reload=1`.
- After upgrading dependencies, restart the DevServer. When a stale dependency cache breaks rendering or injection, restart with `vp dev --host --port 3021 --force` and reload the browser.
- The debug plugin is pnpm-linked from a sibling repo. If Vite warns `vite-plugin-vois-webview-debug not installed`, the pipeline is off for this checkout and every verification here is invalid until it resolves.
- **One DevServer per worktree.** The plugin truncates `apps/website/.tmp/vois-webview-debug/events.jsonl` at startup, so a second server erases the first run's capture. A second concurrent instance needs `git worktree add`.
- **One backend.** All `/v2` traffic goes to the real API; there is no mock server anymore.
- Teardown: stop the process this run started — the pane you created, or the pid `bg_status` reports. Never `pkill -f vite`: other worktrees and the user's own server share that name.
- Production artifact and subpath checks, only when that is the question: `vp run preview:production` (port 8080, `--debug` required for the debug account). The artifact uses relative asset paths (`base: './'`), so a subpath regression shows up here as a blank page rather than in production. Daily work is the DevServer.

## Doctor

```sh
node .pi/skills/verify-vois-webview/scripts/doctor.mjs          # human summary
node .pi/skills/verify-vois-webview/scripts/doctor.mjs --json   # full report
```

Read-only, exits non-zero when the instance is not worth driving. It answers: is a debug server answering, did a page connect in _this_ session, is the served source older than the session, which worktree/revision is this, did the `/v2` calls succeed or is auth dead. Run it before the first drive, after every server restart, and after any failed drive. It never prints tokens.

What doctor cannot see: a wedged UI on a healthy process — a stale dialog, a screen stuck loading, a page that answered before its data arrived. When the process is healthy and the screen is not, reset (reload, or `goto('#/')` and re-navigate) and doctor again rather than inspecting further.

## Drive

**UI — `ego-browser`** (repo mandate, see `.agents/skills/ego-browser`). One TaskSpace for the whole task; reuse its numeric id across rounds; navigate one page (`p1`) with `goto()` instead of opening tabs. The user's shared profile holds the signed-in session — never clear storage, switch profiles, or launch another browser.

```sh
ego-browser nodejs <<'EOF'
const task = await taskSpace(32);
const page = task.page("p1");
await page.goto("http://localhost:3021/#/devices");
await new Promise(r => setTimeout(r, 2500));          // let the /v2 calls land
await page.click('loc=role:button[name*="wl1848581"]', { label: "open device detail" });
console.log(await page.snapshot());
EOF
```

Selectors: `loc=role:<role>[name*="…"]` first (screens carry ARIA labels: `返回`, `选择日期`, `导航`), `loc=css:…` second, snapshot refs last. Text is Simplified Chinese — match it as rendered.

**Headless and API — the `vois-debug` MCP server** (`.pi/mcp.json`, reachable when Pi runs in this repo). From a codemode script, `searchTools("vois-debug")` then `tools['mcp__vois-debug__status'|'__events'|'__login'|'__token'|'__api']({})`. `events` is the redacted reader: use it instead of `cat`ting the capture.

**Raw pipeline** (when the MCP server is unavailable):

- `curl -s http://127.0.0.1:3021/__debug/status` → `{count, sizeBytes, sessionStartedAt, now}`. `sessionStartedAt` is the identity of the instance you launched: if it changed, the server restarted and everything captured before is stale.
- `apps/website/.tmp/vois-webview-debug/events.jsonl` — one JSON object per line. `vp run website#debug:logs` prints it a human-readable way; **its output includes auth parameters verbatim and is secret**.

| Event       | Trigger                                                   |
| ----------- | --------------------------------------------------------- |
| `lifecycle` | load, SPA nav, foreground/background                      |
| `network`   | any `fetch()` — full URL, request body, and response body |
| `console`   | `log` / `warn` / `error`                                  |
| `error`     | unhandled rejection, `onerror`                            |
| `bridge`    | native messages (`get-page-params`, `close-page`, …)      |

`network` events carry `method`, `url`, `status`, `requestBody`, and `responseBody`; `bridge` events carry `direction` (`send` / `receive`) and `protocol`. That is where native handshakes are observable without a native app.

**Entry points.** Hash routes are legitimate user entry points — native opens the WebView by URL, so `#/devices/1848581` is how a real user lands there. What is not a user path: poking a composable, calling an internal setter, or replacing a click with a router push. Debug inputs ride the query (`?login-id=456`, `?hardware-id=441`; the hash query wins over the outer search and token fields are ignored).

Never print auth parameters. Event URLs carry `token=`, `sign=`, `appid=`; response bodies carry real friend lists, IMEIs, and phone numbers.

## Evidence

Artifacts go to `apps/website/.tmp/verify/<feature-id>/` (gitignored, survives teardown). Name them so a reader can tell which run and which entry point they came from.

A proof is three things, not one:

1. **The action** — the command or click that a user performs, verbatim.
2. **The resulting state** — an ARIA snapshot or screenshot of the screen after it, showing the screen still identifies itself (header title, tab, account).
3. **The side effect** — the `network` or `bridge` event the action produced, with its status and the field(s) that changed. A DOM-only change is not proof of persistence.

Proof standards for this app:

- **UI ↔ capture agreement.** The rendered count and values must match the `responseBody` of the call that fed them. Disagreement means the screen is showing something else (cache, stale render, another account) — investigate before writing anything down.
- **Judge a response by `errcode`, not by HTTP status.** This API answers `200` with `errcode: 1` and an `errmsg` that the UI prints verbatim (`接口不存在`, `权限受限`, `您不是群主`). A `2xx` alone proves nothing, and a screen can render correctly while one of its calls 404s.
- **Only what the proof needs.** Extract the fields you assert on; never copy a whole `responseBody` or a raw event line into an artifact. Always strip `token`, `sign`, `appid`, `access-token`, and credential keys.
- **Side effects on the real backend.** Anything that writes (create/update/remove, submit, upload, bind) hits production data for the debug account, and some of it rings hardware the user is wearing. There is no mock to isolate writes anymore, so verify writes by safe observation — the request the UI built, the field cap, the disabled state, the validation message — and prefer read-only or reversible targets. Mark anything unverified this way as skipped, not as passed.
- **Dry runs and skips are not passes.** If a path could not be driven, record the attempt and the unmet precondition (`features/*Gotchas*`, and the run notes); never claim it through a different path, and never weaken a journey to make it pass.
- **404s are findings, not noise.** `POST /v2/device/contacts` and `/v2/device/emergency-contacts` currently answer 404 against the real API. A feature that lands on _无法连接服务器_ with a 404 in the capture is reported as observed, with the endpoint and status.

## Cleanup

- Stop the DevServer this run started (its pane or pid). Leave the user's server and other panes alone.
- Undo scratch: reload a page you typed into without submitting; delete temp files you created outside the evidence directory.
- Keep `apps/website/.tmp/verify/**`. Cleanup removes instances and scratch state, never the evidence; confirm after teardown that the artifacts still exist at their named path.
- Release the ego-browser TaskSpace the way the ego-browser skill says; if the user was driving, hand it back instead of closing.

## Helpers

| Helper                      | Invocation                                                                      |
| --------------------------- | ------------------------------------------------------------------------------- |
| Instance doctor (read-only) | `node .pi/skills/verify-vois-webview/scripts/doctor.mjs [--port 3021] [--json]` |
| Feature map                 | `.pi/skills/verify-vois-webview/features/README.md`                             |

Anchors to keep honest as the app changes: `.pi/skills/maintain-verification-skill` walks this map against source and live behavior.
