# Device list

The device list shows every device the signed-in manager account owns, with its display name, model, and online state, and opens one device's detail page.

## Sub-features

- `list-load` renders one row per device the manager API returns.
- `list-state` shows an offline marker for a device whose API `online` is false.
- `list-open` opens the device detail page for the row the user chose.
- `list-empty` renders when the account owns no devices.

## How to get to it (user POV)

- Choose 设备管理 on the home screen (`#/`).
- Open `#/devices` directly; native opens this page by URL.
- Use the header 返回 to leave the page.

## Driving it with ego-browser

Preconditions:

- `node .pi/skills/verify-vois-webview/scripts/doctor.mjs` exits 0 for the instance you launched.
- The signed-in account owns at least one device. With none, report `list-empty` as unreached, record why in `Gotchas`, and skip the rest.

- **Open the list.** Run `await page.goto("http://localhost:3021/#/devices")`, then wait for the capture to gain its call (not for a fixed delay). The capture gains `POST /v2/subuser/manager-get-all-device` with status 200, and `main` lists rows.
- **Read one row.** Inspect the rows with `page.evaluate()` over `main ul li`: each row's text contains that device's `nick` and `product`, and the row carries an element with `aria-label="离线"` when the same entry has `online: false`.
- **Agree with the capture.** Read the last `manager-get-all-device` event from `.tmp/vois-webview-debug/events.jsonl` and count `responseBody.data.devices`. The number of `main ul li` rows equals that count; a mismatch means the screen is not rendering this call's data.
- **Open a device.** Choose the row. Run `await page.click('loc=role:button[name*="<nick>"]', { label: "open device detail" })`. The URL becomes `#/devices/<user_id>` and the header title is that device's `nick`.
- **Proof.** Run `await page.snapshot()` and write it to `apps/website/.tmp/verify/device-list/list.aria.txt`, then `await page.screenshot({ path: 'apps/website/.tmp/verify/device-list/list.png' })`. Both artifacts show the header 设备, each row's name and model, and the offline marker; neither contains a `token`/`sign`/`appid` value.

## Gotchas

- The fleet belongs to the debug account: row count, names, and ids change between accounts and over time. Assert agreement with the capture, never a fixed device name.
- A row is a `button`, not a link — `a[href*="/devices/"]` finds nothing.
- With zero devices the empty state replaces the rows; there is no seeded fixture to create one, so the journey reports the failure and stops.
