# Device list

The device list shows every device the signed-in manager account owns under the 已连接设备 section title, one row per device, and opens one device's detail page. A row is the avatar, the device's nick, and its 型号 — nothing else.

## Sub-features

- `list-load` renders one row per device the manager API returns, under the 已连接设备 heading.
- `list-row` shows the avatar, the nick, and the 型号 (`product`) as the row's only subtitle. There is no presence dot and no 微喇号/IMEI line.
- `list-open` opens the device detail page for the row the user chose.
- `list-empty` keeps the 已连接设备 heading and shows 暂无已连接设备 when the account owns no devices.

## How to get to it (user POV)

- Choose 设备管理 on the home screen (`#/`).
- Open `#/devices` directly; native opens this page by URL.
- Use the header 返回 to leave the page.

## Driving it with ego-browser

Preconditions:

- `node .pi/skills/verify-vois-webview/scripts/doctor.mjs` exits 0 for the instance you launched.
- The signed-in account owns at least one device. With none, report `list-empty` as unreached, record why in `Gotchas`, and skip the rest.

- **Open the list.** Run `await page.goto("http://localhost:3021/#/devices")`, then wait for the capture to gain its call (not for a fixed delay). The capture gains `POST /v2/subuser/manager-get-all-device` with status 200, and `main` shows the 已连接设备 heading followed by the rows.
- **Read one row.** Inspect the rows with `page.evaluate()` over `main ul li`: each row's text contains that device's `nick` and, when `product` is not empty, its `product` as the single subtitle. The row has no presence dot and no 微喇号/IMEI text.
- **Agree with the capture.** Read the last `manager-get-all-device` event from `.tmp/vois-webview-debug/events.jsonl` and count `responseBody.data.devices`. The number of `main ul li` rows equals that count; a mismatch means the screen is not rendering this call's data.
- **Open a device.** Choose the row. Run `await page.click('loc=role:button[name*="<nick>"]', { label: "open device detail" })`. The URL becomes `#/devices/<user_id>` and the header title is 设备详情.
- **Proof.** Run `await page.snapshot()` and write it to `apps/website/.tmp/verify/device-list/list.aria.txt`, then `await page.screenshot({ path: 'apps/website/.tmp/verify/device-list/list.png' })`. Both artifacts show the header 设备, the 已连接设备 heading, each row's nick and 型号; neither contains a `token`/`sign`/`appid` value.

## Gotchas

- The presence dot is gone by design: `aria-label="离线"` (and any online marker) matches no element on this page, so a row with only two lines is the current design, not a regression.
- The row no longer prints 微喇号 or IMEI; 设备号 and 微喇号 live on the detail page, behind the row.
- The fleet belongs to the debug account: row count, names, and ids change between accounts and over time. Assert agreement with the capture, never a fixed device name.
- A row is a `button`, not a link — `a[href*="/devices/"]` finds nothing.
- With zero devices the 已连接设备 heading stays and 暂无已连接设备 replaces the rows; there is no seeded fixture to create one, so the journey reports the failure and stops.
