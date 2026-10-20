# Device reminders

A device's reminder page lists the alarms set on it, tells the user when there are none, and opens the form that creates one — a form whose rows follow the native order 重复 → 内容 → 响铃时长 → 重复响铃次数 → 重复响铃间隔.

## Sub-features

- `reminders-list` lists each reminder sorted by clock time (`HH:mm`) in a card: a 24px time, a 16px content line, and a 14px grey repeat rule (只响一次 / 每天 / 周一至周五 / the custom day list / 每月 N 日).
- `reminders-empty` shows 暂无提醒。 when the device has none.
- `reminders-new` opens the new-reminder form from the floating 新建提醒 button.
- `reminders-open` opens an existing reminder for editing.
- `reminders-form` shows the five rows in native's order: 重复 (a picker), 内容 (the text editor), then 响铃时长, 重复响铃次数, 重复响铃间隔.
- `reminders-empty-content` intercepts a save with an empty 内容: a dialog titled 提醒内容 with the body 提醒内容为空，是否进入内容编辑界面？, where 取消 stays on the form and 确定 opens the content editor.

## How to get to it (user POV)

- Device detail → 提醒 (in-app link).
- Native deep link to `#/devices/<id>/reminders`.
- The floating 新建提醒 button inside the page.

## Driving it with ego-browser

Preconditions:

- This feature answers from the real API: `ext/rmdr/get-all-reminder`.
- The real device id.

- **Open.** From device detail choose 提醒, or run `await page.goto("http://localhost:3021/#/devices/1848581/reminders")`. The header reads 提醒 and the capture gains `POST /v2/ext/rmdr/get-all-reminder` with `errcode: 0`.
- **Agree with the capture.** When `responseBody.data` holds no reminders, `main` reads 暂无提醒。 and there is exactly one `main` button, the 新建提醒 floating button. Otherwise the number of rows equals the number of reminders, and each row shows `time` at 24px, `content` at 16px, and the repeat label at 14px in the secondary grey (只响一次, or the daily/weekday variant).
- **New form.** Run `await page.click('loc=role:button[name="新建提醒"]')`. The URL becomes `#/devices/1848581/reminders/new` and the header reads 新建提醒; the rows read, in order, 重复 (只响一次 by default), 内容 (暂无 when empty), 响铃时长 30秒, 重复响铃次数 3次, 重复响铃间隔 5分钟, and the header action is 确定. The 重复 sheet offers 只响一次 / 每天 / 周一至周五 / 自定义, closed with 取消; 自定义 opens a 选择重复日期 sheet with seven day chips.
- **Empty content.** With 内容 empty, press 确定. Nothing is sent; a dialog titled 提醒内容 opens with the body 提醒内容为空，是否进入内容编辑界面？ and the buttons 取消 / 确定. 取消 returns to the form, 确定 opens the content editor, whose title is also 提醒内容 and whose save fills the 内容 row. The capture gains no `add-reminder`/`change-reminder` call at this point.
- **Repeat rules survive a round trip.** A weekly rule outside Monday-Friday reads back as its own day list, and a monthly rule (`repeated_type: 3`) reads back as 每月 N 日; editing any other field and saving must resend the same `repeated_type` and `repeated`.
- **Open existing.** When a reminder exists, choose its row: the URL becomes `#/devices/1848581/reminders/<reminderId>` with the same form filled in.
- **Proof.** Write `apps/website/.tmp/verify/device-reminders/mode-R/empty.aria.txt`, `new.png`, and `agreement.json` with `{ apiReminders: 0, domRows: 0, emptyText: "暂无提醒。" }`. Do not submit the form: 确定 writes a reminder to a real device.

## Gotchas

- The wheel time picker is not implemented. The 24px 下午 5:32 label is styled text over a transparent `<input type="time">` (`aria-label="时间"`), so a tap opens the browser/OS time control. A missing wheel is the current design, not a regression, and the accessible handle is the time input rather than a wheel column.
- The form rows are 重复 → 内容 → 响铃时长 → 重复响铃次数 → 重复响铃间隔. 内容 sits among the pickers, so a run that looks for the content row last will not find it there.
- 重复 is a single-select sheet closed with 取消; the ring rows are sheets too. Only 内容 opens the text editor.
- An empty 内容 no longer toasts 请输入提醒内容: it opens the 提醒内容 dialog, and 确定 there opens the editor instead of saving. A verifier expecting a toast will see nothing; a verifier pressing 确定 twice saves nothing.
- With no reminders the journey cannot exercise the row or edit path; report the empty state as observed and record why the row assertions were skipped. Do not create a reminder just to make the journey pass.
- The 新建提醒 button is icon-only; its accessible name is the only stable handle (`loc=role:button[name="新建提醒"]`, or `css:button[aria-label="新建提醒"]`).
- 确定 is a write against a real device, which rings on hardware the user may be wearing. Stop at the filled form.
- `delete-reminder` has a known backend bug (answers success, keeps the row); verify a delete only when the run is explicitly about it, and expect the list to keep the reminder.
- This list is per device: a reminder added on another device does not appear here.
