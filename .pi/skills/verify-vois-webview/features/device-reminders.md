# Device reminders

A device's reminder page lists the alarms set on it, tells the user when there are none, and opens the form that creates one.

## Sub-features

- `reminders-list` lists each reminder with its time, content, and repeat rule.
- `reminders-empty` shows 暂无提醒。 when the device has none.
- `reminders-new` opens the new-reminder form from the floating action button.
- `reminders-open` opens an existing reminder for editing.

## How to get to it (user POV)

- Device detail → 提醒 (in-app link).
- Native deep link to `#/devices/<id>/reminders`.
- The floating 新建提醒 button inside the page.

## Driving it with ego-browser

Preconditions:

- **Mode R** (this feature answers from the real API: `ext/rmdr/get-all-reminder`). In mode M the mock answers 接口不存在.
- The real device id.

- **Open.** From device detail choose 提醒, or run `await page.goto("http://localhost:3021/#/devices/1848581/reminders")`. The header reads 提醒 and the capture gains `POST /v2/ext/rmdr/get-all-reminder` with `errcode: 0`.
- **Agree with the capture.** When `responseBody.data` holds no reminders, `main` reads 暂无提醒。 and there is exactly one `main` button, the 新建提醒 floating button. Otherwise the number of rows equals the number of reminders, and each row shows `time`, `content`, and the repeat label (只响一次, or the daily/weekday variant).
- **New form.** Run `await page.click('loc=role:button[name="新建提醒"]')`. The URL becomes `#/devices/1848581/reminders/new` and the header reads 新建提醒; the form shows 内容 (暂无 when empty), 重复 (只响一次 by default), 响铃时长 30秒, 重复响铃次数 3次, 重复响铃间隔 5分钟, and the 确定 action.
- **Open existing.** When a reminder exists, choose its row: the URL becomes `#/devices/1848581/reminders/<reminderId>` with the same form filled in.
- **Proof.** Write `apps/website/.tmp/verify/device-reminders/mode-R/empty.aria.txt`, `new.png`, and `agreement.json` with `{ apiReminders: 0, domRows: 0, emptyText: "暂无提醒。" }`. Do not submit the form: 确定 writes a reminder to a real device.

## Gotchas

- With no reminders the journey cannot exercise the row or edit path; report the empty state as observed and record why the row assertions were skipped. Do not create a reminder just to make the journey pass.
- The 新建提醒 button is icon-only; its accessible name is the only stable handle (`loc=role:button[name="新建提醒"]`, or `css:button[aria-label="新建提醒"]`).
- 确定 is a write against a real device, which rings on hardware the user may be wearing. Stop at the filled form.
- This list is per device: a reminder added on another device does not appear here.
