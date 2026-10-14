# Device recharge

The recharge page lists devices whose SIM subscription is running out, lets the user pick which ones to renew, and totals the price; the records page lists past orders.

## Sub-features

- `recharge-list` lists each device with model, IMEI, ICCID, expiry, and unit price.
- `recharge-select` selects devices and drives the 全选 control.
- `recharge-total` shows 合计 as the sum of the selected unit prices and enables 充值 only when something is selected.
- `recharge-records` lists past top-up orders with order number, amount, state, and time.

## How to get to it (user POV)

- URL-only routes (`/devices/recharge`, `/devices/:id/recharge-records`): nothing in this repo links them and the documented native entry points do not list them. They render, but no user path to them is proven.

## Driving it with ego-browser

Preconditions:

- **Mode M**: in mode R both screens render 无法连接服务器 because `device/recharge-list` and `device/recharge-records` answer HTTP 404.
- Mock device ids `101` and `102`; the mock prices them at ¥30.00 and ¥20.00.

- **List.** Run `await page.goto("http://localhost:3021/#/devices/recharge")`. The header reads 待续费设备 and the capture gains `POST /v2/device/recharge-list` with `errcode: 0`. Each row is a label wrapping a checkbox whose accessible name is the device `nick`, and shows 型号, 设备号, 卡 ICCID, 卡到期时间, and 续费单价.
- **Selected state.** Read the footer: `合计: ¥0.00` and the 充值 button carries `disabled` while nothing is selected.
- **Select all.** Run `await page.click('css:input[aria-label="全选"]')`. `document.querySelectorAll('main input[type=checkbox]:checked').length` is `devices + 1` (the select-all box counts too), 合计 equals the sum of the listed 续费单价 (¥50.00 for the two mock devices), and 充值 loses `disabled`.
- **Deselect one.** Run `await page.click('css:input[aria-label="工作手机"]')`. 合计 drops by that device's price (¥20.00), and 充值 stays enabled while one row remains selected.
- **Records.** Run `await page.goto("http://localhost:3021/#/devices/101/recharge-records")` (`POST /v2/device/recharge-records`). The header reads 流量卡充值记录 and each row shows 订单号, the amount, 状态, and the timestamp.
- **Proof.** Write `apps/website/.tmp/verify/device-recharge/mode-M/list.aria.txt`, `list.png`, and `selection.json` with `{ scanned: "0.00", all: "50.00", one: "20.00", checked: [0, 3, 1], buyDisabled: [true, false, false] }`. Stop before 充值: it starts an order.

## Gotchas

- 充值 is a write (it creates a recharge order). Verify the selection and the total; do not submit unless the run is explicitly about ordering, and then only against the mock.
- The select-all checkbox is part of the checked count; assert on the sum and the disabled state, not on a raw checkbox count alone.
- Prices and device lists come from the fixture. Assert the sum against the prices rendered on the same screen instead of a fixed `¥50.00`.
- Mode R prints 无法连接服务器 and there is nothing to select.
