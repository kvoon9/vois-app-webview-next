# Device detail

One device's page is titled 设备详情 and leads with the device's avatar, its nick, and 激活时间, then four cards: identity (with the SIM rows when the device has a card), the three management entries, the position entries behind the 共享位置 switch, and 解除绑定. Its header back either pops an app page or asks native to close the WebView.

## Sub-features

- `detail-open` opens from the device list and renders that device's fields.
- `detail-header` shows the avatar with a pencil badge on its corner, the nick with its 重命名设备 pencil, and 激活时间: `<date>` (暂无 when the API has none) as the line under the name.
- `detail-identity` (card 1) lists 型号, 设备号 with a 复制 action, 版本号, 微喇号 from `POST /v2/subuser/device-get-detail`; when the response carries a `sim_card` it appends 卡 ICCID, 卡到期时间, 卡片状态 需充值 (only when `recharge`), and the 流量卡充值记录 / 待续费设备 links.
- `detail-manage` (card 2) offers 群组管理, 联系人管理, 紧急联系人设置.
- `detail-position` (card 3) puts the 共享位置 switch first (hidden only when `location_support` is `false`), then 位置和围栏, 轨迹记录, 轨迹上报设置, and 提醒 (hidden only when `reminder_support` is `false`). The three tracking rows never gate; the flags speak about sharing and reminding, not tracking.
- `detail-unbind` (card 4) is one red 解除绑定 row that asks 提示 / 是否解除绑定设备？ with 取消 and 确定.
- `detail-back-pop` pops back to the list when the app has an earlier entry.
- `detail-back-close` sends `close-page` to native when the page is the app's first entry.

## How to get to it (user POV)

- Choose a row on the device list (`#/devices`).
- Open `#/devices/<device id>` directly; native deep-links this way.
- Use the header 返回.

## Driving it with ego-browser

Preconditions:

- The device-list preconditions, plus the id of a device that account owns (the API `user_id`, not the 微喇号).

- **Open from the list.** Run `await page.goto("http://localhost:3021/#/devices")`, then `await page.click('loc=role:button[name*="<nick>"]')`. The URL becomes `#/devices/<user_id>` and the header title is 设备详情.
- **Check the header block.** The name block shows the nick with its 激活时间 line, and the avatar's accessible name is 修改设备头像 (either the avatar or its pencil badge opens the crop). 激活时间 equals `activatedAt` of the captured `device-get-detail`, or 暂无 when the response has none.
- **Check identity.** Compare the rendered 型号, 版本号, and 微喇号 with `product`, `version`, and `user_num` of the captured `device-get-detail`. The 设备号 row shows `imei` and its 复制 button (`aria-label="复制设备号"`) toasts 已复制。 A field that disagrees with the response is the finding.
- **Check the cards.** Card 2 shows exactly 群组管理 / 联系人管理 / 紧急联系人设置; card 3 starts with the 共享位置 switch (`aria-label="共享位置"`) when the captured `device-get-detail` does not carry `location_support: false`, then always 位置和围栏 / 轨迹记录 / 轨迹上报设置, then 提醒 unless the capture carries `reminder_support: false`; card 4 is one 解除绑定 row in red. An absent flag means the row renders.
- **Cold deep load.** Run `await page.goto("about:blank")` then `await page.goto("http://localhost:3021/#/devices/<user_id>")`. The page fetches the device itself (the capture gains `device-get-detail`) and renders the same fields; blanks here mean the row came from a previous page rather than a fetch.
- **Unbind dialog (read-only).** Choose `await page.click('loc=role:button[name="解除绑定"]')`. The dialog's title is 提示, its body 是否解除绑定设备？, its buttons 取消 and 确定. Press 取消; do not press 确定.
- **Back pops.** Starting from the list, reopen the device and choose 返回: `await page.click('loc=role:button[name="返回"]')`. The URL returns to `#/devices` and the capture gains no `close-page`.
- **Back closes.** After the cold deep load, choose 返回. The capture gains a `bridge` event with `"direction":"send"` and `"protocol":"close-page"`, and the URL does not change — native is what closes the page.
- **Proof.** Write `apps/website/.tmp/verify/device-detail/<nick>.aria.txt` and `.png`, plus `close-page.json` holding that single bridge event line (no query strings, no credentials).

## Gotchas

- The header title is 设备详情, not the device's nick; the nick is the heading inside the name block under the avatar.
- 确定 in the unbind dialog really unbinds the device (`POST /v2/subuser/device-unbind`, then the page leaves the list). Stop at 取消 unless the run is explicitly about unbinding.
- The labels sit in four cards now: identity, management, the position card led by the 共享位置 switch, and 解除绑定. Looking for one flat five-row list on the page is the wrong expectation.
- The copy reads 共享位置 and 解除绑定 (not 位置共享 / 解绑设备), and the unbind body is 是否解除绑定设备？.
- The id in the URL is the API `user_id` (for example 1848581), not the 微喇号 `user_num` (for example 301010367339) printed on the page.
- 返回 pops only when the app has an earlier entry. Clicking through from the list is expected to pop; a fresh deep load is expected to send `close-page`. Neither is a driver failure.
- Leaving through `router.back()` or a hand-rolled fallback drops the native `close-page` handshake. That is a regression worth reporting, not a shortcut worth taking.
- Snapshot refs go stale after navigation; re-snapshot or use role selectors.
- The detail page gates the 共享位置 switch on `location_support` and the 提醒 row on `reminder_support` from its captured `device-get-detail`; an absent or `true` flag renders the row, only `false` hides it. `device-get-detail` is the authoritative source and feeds the shared device query every child reads. `manager-get-all-device` may still disagree on the flags; no UI renders its values.
- A native deep link to `#/devices/<id>/reminders` still renders the reminders page on a device with `reminder_support: false`; only the detail rows hide. Current native hides the entry, so this path means an older app binary.
- The drive never assumes the debug devices' flag values. Capture `device-get-detail` first and set the card-3 row expectations from the captured `location_support` / `reminder_support`; when no drivable device presents an explicit false, record the hidden state as skipped with the unit tests plus review as its evidence, never as a passed drive.
- `manager-get-all-device` currently returns no `sim_card`, so 卡 ICCID, 卡到期时间, 卡片状态, 流量卡充值记录, and 待续费设备 do not render for such devices.
