# Device detail

One device's page shows its identity — activation date, model, device number, version, 微喇号 — and links to its groups and reminders. Its header back either pops an app page or asks native to close the WebView.

## Sub-features

- `detail-open` opens from the device list and renders that device's fields.
- `detail-identity` shows 激活时间, 型号, 设备号, 版本号, 微喇号 from `POST /v2/subuser/device-get-detail`.
- `detail-links` offers 位置和围栏, 轨迹记录, 轨迹上报设置, 群组管理, 联系人管理, 紧急联系人设置, and 提醒 for that device (plus the recharge entries when the response carries a SIM card), as separate 48px cards 12px apart.
- `detail-back-pop` pops back to the list when the app has an earlier entry.
- `detail-back-close` sends `close-page` to native when the page is the app's first entry.

## How to get to it (user POV)

- Choose a row on the device list (`#/devices`).
- Open `#/devices/<device id>` directly; native deep-links this way.
- Use the header 返回.

## Driving it with ego-browser

Preconditions:

- The device-list preconditions, plus the id of a device that account owns (the API `user_id`, not the 微喇号).

- **Open from the list.** Run `await page.goto("http://localhost:3021/#/devices")`, then `await page.click('loc=role:button[name*="<nick>"]')`. The URL becomes `#/devices/<user_id>`, the header title is `nick`, and `main` shows the five labels.
- **Check identity.** Compare the rendered 型号, 版本号, and 微喇号 with `product`, `version`, and `user_num` of the captured `device-get-detail` response. A field that disagrees with the response is the finding.
- **Cold deep load.** Run `await page.goto("about:blank")` then `await page.goto("http://localhost:3021/#/devices/<user_id>")`. The page fetches the device itself (the capture gains `device-get-detail`) and renders the same fields; blanks here mean the row came from a previous page rather than a fetch.
- **Back pops.** Starting from the list, reopen the device and choose 返回: `await page.click('loc=role:button[name="返回"]')`. The URL returns to `#/devices` and the capture gains no `close-page`.
- **Back closes.** After the cold deep load, choose 返回. The capture gains a `bridge` event with `"direction":"send"` and `"protocol":"close-page"`, and the URL does not change — native is what closes the page.
- **Proof.** Write `apps/website/.tmp/verify/device-detail/<nick>.aria.txt` and `.png`, plus `close-page.json` holding that single bridge event line (no query strings, no credentials).

## Gotchas

- The id in the URL is the API `user_id` (for example 1848581), not the 微喇号 `user_num` (for example 301010367339) printed on the page.
- 返回 pops only when the app has an earlier entry. Clicking through from the list is expected to pop; a fresh deep load is expected to send `close-page`. Neither is a driver failure.
- Leaving through `router.back()` or a hand-rolled fallback drops the native `close-page` handshake. That is a regression worth reporting, not a shortcut worth taking.
- Snapshot refs go stale after navigation; re-snapshot or use role selectors.
- The detail page calls `device-get-detail` for its fields and `manager-get-all-device` only for the list. The two answers can disagree on `location_support` / `reminder_support`; treat those flags as unusable until the backend settles them (the page does not gate entries on them).
- `manager-get-all-device` currently returns no `sim_card`, so the 流量卡 section and both recharge entries do not render for such devices.
