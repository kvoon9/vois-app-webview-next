# Device recharge

Renewal and payment for a device's SIM card. The device detail's 缴费充值 entry and the 待续费设备 page's per-card 续费 action both create one renewal order and pay it through WeChat app pay when the app supports the bridge action. The records page lists the account's past renewal orders.

## Sub-features

- `recharge-entry` is the 缴费充值 control in the device detail info card, at the right of the 型号 row. It renders only when the device has a SIM card and opens the confirm modal. Each tap creates a new order; it never reuses a previous unpaid order.
- `recharge-confirm` shows the product name, the product description, and the amount in yuan, with 支付 as the action.
- `recharge-pay` sends the order through the bridge `wechat-app-prepay` and renders the result states: 确认支付, 支付中, 支付成功, 支付失败, and 当前 App 版本不支持网页内支付，请升级 App。 The paying modal has a manual 关闭 action; closing it only hides the modal, the bridge result can still land.
- `recharge-list` lists each SIM card due for renewal with its device model, device number, ICCID, and expiry; each row has a 续费 action. The list carries no unit price and has no checkboxes.
- `recharge-item` starts one renewal from a row's 续费 action: it creates one order for that card and stops at the confirm modal. Each tap creates a new order; the next card is a separate order.
- `recharge-records` lists the account's renewal orders with order number, amount, state, and time.

## How to get to it (user POV)

- Device detail → 缴费充值 (in the info card, at the right of the 型号 row; shown when the device has a SIM card).
- Device list header → 待续费设备 (top-right action; always shown; opens `/devices/recharge`).
- Device detail → 流量卡充值记录 (in-app link; shown whenever the device has a SIM card).
- Open `#/devices/recharge` or `#/devices/<id>/recharge-records` directly; native may deep-link this way.

The records list is account-wide (`simcard-get-all-renew-order` takes no device), so the `<id>` in the records URL does not scope the rows.

## Driving it with ego-browser

Preconditions:

- The device-detail preconditions, plus a signed-in debug account that owns at least one card due for renewal. With none, the list renders its empty state; report that and skip the selection assertions.
- The real API is the only backend: `simcard-get-all-need-renew`, `simcard-create-renew-order`, `simcard-get-all-renew-order`. There is no mock server.
- `pay_method` and `pkg_name` come from native page params: the app sends `pay-method` (default `wechat`) and `pkg-name`. Outside the app the defaults apply. iOS 5.0.6 and the 1.0.0 reinstall return none of `pay-method`, `pkg-name`, `wxpay-appid`, `device-type` (observed; `.pi/skills/verify-vois-native`), so the defaults apply inside both apps.
- Pay runs through the bridge, not the page: 支付 sends `wechat-app-prepay`, the app calls WeChat, and the H5 finishes on the reply. The DevServer's debug bridge has no `wechat-app-prepay` answer of its own (checked 2026-11-09), so the full exchange completes only inside the app.

- **Open from the list.** On `#/devices`, click the header action 待续费设备. The URL becomes `#/devices/recharge` and the header reads 待续费设备.
- **List.** Run `await page.goto("http://localhost:3021/#/devices/recharge")`. The header reads 待续费设备 and the capture gains `POST /v2/subuser/simcard-get-all-need-renew` with `errcode: 0`. Each row shows 型号, 设备号, 卡 ICCID, 卡到期时间, and a 续费 action; there are no checkboxes and no 续费单价 field.
- **Agree with the capture.** The number of rows equals `responseBody.data.renews.length`, and a row's `iccid`, `imei`, and `expiry_date` match its `renews` entry.
- **Renew one card.** Click the row's 续费 action. The capture gains `POST /v2/subuser/simcard-create-renew-order` with `{ iccid, pay_method, pkg_name }`; the confirm modal shows the product, description, and amount in yuan. 取消 closes it and leaves the order unpaid; 支付 starts the bridge.
- **Entry.** From `#/devices/<id>` of a device whose captured `device-get-detail` carries `sim_card`, the info card shows 缴费充值 at the right of the 型号 row. For a device without `sim_card` the entry is absent. Both states check against the same capture.
- **Confirm modal.** Click 缴费充值 or a row's 续费. The modal shows the product name, the product description, and the amount in yuan. 支付 is the action.
- **Pay (app-only exchange).** Click 支付. The capture gains a `bridge` event with `"direction":"send"` and `"protocol":"wechat-app-prepay"`. Success is the reply carrying `errcode: 0` together with `data.wxpaycode: 0`, then the follow-up `POST /v2/pay/pay-wechat-trade-success` with `{ order_no, trade_no }` (field shape per the sibling project; this app's capture has not shown the request yet). The state moves 确认支付 → 支付中 → 支付成功. Any other reply is 支付失败, and on a build whose bridge answers `Unknown action` (iOS 5.0.6) the state is 当前 App 版本不支持网页内支付，请升级 App。 A bridge that never answers (a WeChat-side rejection can do that on iOS 1.0.0) times out after 120 seconds into 支付结果未知，请稍后在充值记录中确认。
- **DevServer pay drive.** Without a native pay answer the exchange cannot complete. Drive 支付 anyway to prove the send, record which state renders, and report it as a send-only drive.
- **42012 data limit.** The debug account's original card `wl301010105341` (user_id 1631010), whose SIM (ICCID ending 1587) runs to 2027-08-31 with `recharge: false`. For that card `simcard-create-renew-order` answers `errcode: 42012`, `errmsg: "SIM卡有效期超过半年,暂不支持续费"`. The newer test device `wl301010386256` (user_id 1683740, ICCID ending 000874, expiry 2026-11-30) creates an order, so use it for the order/pay path. Report 42012 as a test-data limitation, not a pass.
- **Records.** Run `await page.goto("http://localhost:3021/#/devices/<id>/recharge-records")`. The header reads 流量卡充值记录 and the capture gains `POST /v2/subuser/simcard-get-all-renew-order` with `errcode: 0`. Each row shows 订单号, the amount, the state, and the timestamp, and the row count equals `responseBody.data.orders.length`.
- **Proof.** Write `apps/website/.tmp/verify/device-recharge/list.aria.txt`, `list.png`, and `agreement.json` with `{ endpoint, errcode, rows }`. For the per-card flow add `row.png` and `confirm.png`; for the per-device flow add `entry.png`, `modal.png`, and the captured `wechat-app-prepay` bridge pair, plus the 42012 reply when it occurs. Do not copy a whole `responseBody`.

## Gotchas

- 充值 and 支付 are real writes. Creating an order charges nothing, but 支付 inside the app moves real money when the bridge succeeds. Unless the run is explicitly about paying, stop at the confirm modal or the created order, and record the pay path as observed-but-not-paid.
- One card, one order: `simcard-create-renew-order` takes a single `iccid`. The page has no multi-select; each row's 续费 is one order.
- The list carries no price; the only amount the API exposes is on a created order (`amount`, in fen) and on past records. The confirm modal appears only after the order is created, so do not assert a price before then.
- Outside the app `pay_method` / `pkg_name` fall back to defaults (`wechat`, empty); native supplies them in the app. iOS 5.0.6 and the 1.0.0 reinstall answer `get-page-params` with none of `pay-method` / `pkg-name` / `wxpay-appid` / `device-type` (observed 2026-11-09), so the same defaults apply inside both apps.
- iOS 5.0.6 does not register `wechat-app-prepay`: a direct probe answered `{"success":false,"message":"Unknown action"}` (evidence: `docs/native/ios/runtime-2026-11-09.md`, `.pi/skills/verify-vois-native`). That build's native device detail also has no 缴费充值 entry of its own. In that app the flow must end in 当前 App 版本不支持网页内支付，请升级 App。
- The 1.0.0 reinstall registers `wechat-app-prepay`. An empty-data probe returns the protocol envelope with `errcode: -1`; a dummy prepay opens WeChat and can leave the callback pending. The H5 bounds that wait at 120 seconds into 支付结果未知，请稍后在充值记录中确认。 The new test card (ending 000874, expiry 2026-11-30) creates orders and opens WeChat, but the attempts in this run were cancelled, so a successful iOS payment is still unverified.
- Cancel handling is out of scope. A native iOS cancel fix was tested and then reverted; the current build does not return a cancel result and the H5 does not handle one. A cancelled WeChat payment leaves the page on 支付中 until the 120-second deadline, then shows the unknown-result failure; the paying modal has a manual 关闭 that only hides it.
- Android WebView Chrome 92 (App 5.0.8 on Android 10) lacks `Object.hasOwn`; reka-ui calls it when the confirm dialog mounts. `apps/website/src/polyfills.ts` defines it at boot. Without it, 缴费充值 lands on the global 出了点问题 page with a stack at `forwardRef` in reka-ui.
- Every 缴费充值 or 续费 tap creates a new renewal order. A cancelled attempt leaves its order unpaid in the records; the next tap starts a new order. Do not reuse the old order.
- The iOS build does not send `wxpay-appid`; the H5 falls back to the Android app's WeChat app id (redacted in `docs/native/android/v5.0.4+504/page-params.md`). A real iOS payment must confirm the backend prepay uses the iOS app's WeChat app id, or WeChat will reject the request.
- The original debug card (ending 261587, expiry 2027-08-31) trips `errcode: 42012` (`SIM卡有效期超过半年,暂不支持续费`). The new test card (ending 000874, expiry 2026-11-30) creates an order, so use that device for the flow. A created order does not charge until WeChat confirms.
- `POST /v2/pay/create-wechat-app-order` answered `errcode: 0` with a full `prepay` payload (`appid`, `partnerid`, `prepayid`, `noncestr`, `timestamp`, `sign`, `package`, `sign_type`) even for a fabricated, nonexistent `order_no`. That is a backend validation gap to raise with the backend team. It is not a test path: never put a fabricated order number into a real flow.
- Do not report a paid order unless the capture shows the `wechat-app-prepay` reply with `errcode: 0` and `data.wxpaycode: 0` plus the follow-up `pay-wechat-trade-success` request. A created order is not paid.
- The records list is account-wide: the `<id>` in `/devices/<id>/recharge-records` does not filter the rows.
- Judge by `errcode`, not HTTP status. An empty list is a valid `errcode: 0` with `renews: []`.
