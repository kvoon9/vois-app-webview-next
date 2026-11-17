# VOIS WebView verification map

This directory is the maintained source for verifying the user-facing behavior of the VOIS WebView (`apps/website`). Read this index before driving, then use the matching feature file as the recipe.

Twelve features are mapped, covering every route under `src/pages` except `playground` (dev-only). The map is a seed, not a sentence-by-sentence audit of the app.

## Baseline preconditions

- Launch the DevServer as the skill's `Launch` section says. One instance per worktree — a second server truncates the shared capture.
- `~/.vois/.env` holds `VITE_APP_ID` / `VITE_APP_KEY` (copy `apps/website/.env.example` once per machine).
- The page must be connected: `🟢 WebView debug connected` in the capture, `/__debug/status` answering. Compare `sessionStartedAt` with the value recorded at launch before trusting anything captured earlier.
- Sign-in is the debug account, minted by `GET /__vois-bridge/access-token`. The shared ego-browser profile holds the session; never clear browser storage, create a profile, or change the account to make a journey pass.
- The same account is driven by the user. Treat every `/v2` response as production data.

### One backend: the real API

Every `/v2` route goes to the real backend (`https://api.voischat.cn`); the local mock server has been removed. Screens still mid-migration may call endpoints the backend does not implement yet — they fail with the UI's network-error state, which is itself the expected behavior to capture.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise. A feature's `Preconditions:` may chain to another feature file's (device pages depend on the device list); resolve the chain before driving — the baseline above always applies.
- Treat every command and selector as literal. Keep quoted names and flags unchanged.
- Hash routes are user entry points: `http://localhost:3021/#/devices/1848581` is how native opens a page. Prefer the click when the recipe is about reaching a screen through the UI, and the URL when it is about the screen's own state.
- Three kinds of entry point, and they are not interchangeable:
  1. **In-app links** — reachable by clicking (home → 设备管理, device detail → 群组管理).
  2. **Native launch URLs** — documented in `docs/native/android/v5.0.4+504/entry-points.md` (`/help`, `/settings`, `/settings/friends/multi-translation`, `/report-user`, `/report-group`, `/shared/qrcode/…`). Native opens these; the SPA may not link them.
  3. **URL-only routes** — no in-app link and not in the documented native list: `/devices/:id/contacts`, `/emergency-contacts`, `/location`, `/track`, `/recharge*`. They render, but nothing in this repo proves a user can reach them. Say which kind a journey used.
- Choose selectors by role and accessible name (`loc=role:button[name*="…"]`); fall back to `loc=css:…` and snapshot refs. Text is Simplified Chinese as rendered.
- Wait for the `/v2` call that feeds a screen, not for a fixed sleep. `page.evaluate()` staying quiet plus the capture growing is the signal.
- Capture the action, the resulting state, and the side effect together. A DOM change alone is not proof.
- Read-only by default. Anything that writes needs a safe observation or a reversible target (see the skill's Evidence section); the mock backend no longer exists.
- Never print or copy auth parameters (`token`, `sign`, `appid`, `access-token`) or unfiltered response bodies.
- The shared profile injects a translation extension toolbar into every snapshot (扇贝翻译, 选区翻译, 高亮单词, 语境测词, 禅模式, 自定义工具栏). Those nodes are not app UI; ignore them.

## Proof and skip reporting

- **UI ↔ capture agreement is the proof**: the rendered rows must match the `responseBody` of the call that fed them, in count and in the fields the recipe names. There is no seeded fixture in mode R, so never assert a fixed device name or count.
- **Judge responses by `errcode`, not by HTTP status.** This API answers `200` with `errcode: 1` and an `errmsg` the UI prints verbatim (mode M's `接口不存在`, a missing session's `权限受限`). A `2xx` alone proves nothing.
- Capture the user action and the resulting state, not only the final screen. UI proof includes an ARIA snapshot or screenshot showing the screen's own title.
- Record the feature ID, the entry point kind, and the backend mode with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition, and write a new `Gotchas` line when the obstacle will recur.
- Do not report a skipped entry point as verified through a different path.
- Never weaken a journey to make it pass.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point, marking the kind from above.
3. `Driving it with ego-browser` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Device list](./device-list.md) — the manager's device rows, offline state, and entry into a device.
- [Device detail](./device-detail.md) — one device's identity fields, its sub-page entries, and the header back handshake.
- [Device groups](./device-groups.md) — created and joined groups, group detail, members, and the add/search entries.
- [Device contacts](./device-contacts.md) — the contact list, both add flows, and the emergency-contact (SOS) list.
- [Device location](./device-location.md) — the location/fence map, the track map, and the reporting-frequency setting.
- [Device recharge](./device-recharge.md) — the devices due for renewal, the selection total, and the recharge records.
- [Device reminders](./device-reminders.md) — the reminder list, its empty state, and the new-reminder form.
- [Translation settings](./translation-settings.md) — the three settings lists, one friend's detail, group member settings, and multi-translation.
- [Account switching](./account-switching.md) — the home account list and the external-account login form.
- [Help and feedback](./help-and-feedback.md) — the help index, the help guide, and the feedback/report forms.
- [Report](./report.md) — reporting a user or a group from where native launches it.
- [Bluetooth activation](./bluetooth-activation.md) — the QR sheet and the activation page a scanned code opens.
