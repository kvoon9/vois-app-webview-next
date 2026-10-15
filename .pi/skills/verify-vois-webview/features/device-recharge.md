# Device recharge

The recharge page lists the SIM cards under the account that are due for renewal, lets the user pick cards to renew, and creates one order per card; the records page lists the account's past renewal orders.

## Sub-features

- `recharge-list` lists each SIM card due for renewal with its device model, device number, ICCID, and expiry. The list carries no unit price.
- `recharge-select` selects cards and drives the 全选 control; 充值 stays disabled until something is selected.
- `recharge-submit` creates one renewal order per selected card (`simcard-create-renew-order`); the returned amount is in fen (分).
- `recharge-records` lists the account's renewal orders with order number, amount, state, and time.

## How to get to it (user POV)

- Device detail → 待续费设备 (in-app link; shown only when that device's SIM card is flagged `recharge`).
- Device detail → 流量卡充值记录 (in-app link; shown whenever the device has a SIM card).
- Open `#/devices/recharge` or `#/devices/<id>/recharge-records` directly; native may deep-link this way.

The records list is account-wide (`simcard-get-all-renew-order` takes no device), so the `<id>` in the records URL does not scope the rows.

## Driving it with ego-browser

Preconditions:

- The device-detail preconditions, plus a signed-in debug account that owns at least one card due for renewal. With none, the list renders its empty state; report that and skip the selection assertions.
- The real API is the only backend: `simcard-get-all-need-renew`, `simcard-create-renew-order`, `simcard-get-all-renew-order`. There is no mock server.
- `pay_method` and `pkg_name` come from native page params: the app sends `pay-method` (default `wechat`) and `pkg-name`. Outside the app the defaults apply, and payment itself never completes in the H5 — the app is the payer.

- **List.** Run `await page.goto("http://localhost:3021/#/devices/recharge")`. The header reads 待续费设备 and the capture gains `POST /v2/subuser/simcard-get-all-need-renew` with `errcode: 0`. Each row is a checkbox whose accessible name is the card's device nickname and shows 型号, 设备号, 卡 ICCID, and 卡到期时间. There is no 续费单价 field.
- **Agree with the capture.** The number of rows equals `responseBody.data.renews.length`, and a row's `iccid`, `imei`, and `expiry_date` match its `renews` entry.
- **Select.** Run `await page.click('loc=role:checkbox[name*="<user_nick>"]')` for one row, and `await page.click('css:input[aria-label="全选"]')` for all. Read the checkboxes' checked state and the 充值 button's `disabled` property: it stays disabled while nothing is selected.
- **Order (write).** Choosing 充值 opens the confirmation and then calls `POST /v2/subuser/simcard-create-renew-order` once per selected card with body `{ iccid, pay_method, pkg_name }`, returning `{ order_no, amount, currency, product_id, product_name, product_desc }`. `amount` is in fen (分). The H5 cannot collect payment, so on success it only shows the order and tells the user to pay in the app — no charge happens here.
- **Records.** Run `await page.goto("http://localhost:3021/#/devices/<id>/recharge-records")`. The header reads 流量卡充值记录 and the capture gains `POST /v2/subuser/simcard-get-all-renew-order` with `errcode: 0`. Each row shows 订单号, the amount, the state, and the timestamp, and the row count equals `responseBody.data.orders.length`.
- **Proof.** Write `apps/website/.tmp/verify/device-recharge/list.aria.txt`, `list.png`, and `agreement.json` with `{ endpoint, errcode, rows, checked }`. Do not copy a whole `responseBody`.

## Gotchas

- 充值 is a real write: it creates one renewal order per selected card. Payment cannot be completed in the H5 (the page points the user to the app), so creating a real order without paying does not charge the account. A test order is therefore safe, but unless the run is explicitly about ordering, stop at the selection check (选卡 plus the enabled 充值 button) and record the order path as observed-but-not-submitted.
- One card, one order: `simcard-create-renew-order` takes a single `iccid`. Selecting N cards is N calls, not one batch.
- The list carries no price; the only amount the API exposes is on a created order (`amount`, in fen) and on past records. Do not assert a total before an order exists.
- Outside the app `pay_method` / `pkg_name` fall back to defaults (`wechat`, empty); native supplies them in the app. Payment completes in the app, not here.
- The records list is account-wide: the `<id>` in `/devices/<id>/recharge-records` does not filter the rows.
- Judge by `errcode`, not HTTP status. An empty list is a valid `errcode: 0` with `renews: []`.
