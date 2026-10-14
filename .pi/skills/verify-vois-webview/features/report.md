# Report

Reporting a user or a group shows the same reason list and note field; native launches each page with the target in the URL.

## Sub-features

- `report-user` collects a reason and a note for a user (`#/report-user?id=<id>`).
- `report-group` does the same for a group (`#/report-group?id=<id>`).
- `report-reason` picks one of 色情内容 / 虚假信息 / 垃圾营销 / 人身攻击 / 违法内容 / 有害内容 / 欺诈 / 宣扬仇恨 / 其他.
- `report-submit` sends the report.

## How to get to it (user POV)

- Native launch URLs, documented in `docs/native/android/v5.0.4+504/entry-points.md`: profile → `/report-user` with `id`, session/member info → `/report-user` with `id`, group info → `/report-group` with `id`.
- No in-app link reaches these pages.

## Driving it with ego-browser

Preconditions:

- Backend-independent for the form itself: both pages render with no call of their own.
- Do not submit; 提交 writes a report against a real account.

- **User report.** Run `await page.goto("http://localhost:3021/#/report-user?id=<id>")`. The header reads 举报用户, `main` shows 选择举报原因, the nine reason options, a 备注 field, and 提交.
- **Group report.** Run `await page.goto("http://localhost:3021/#/report-group?id=<id>")`. The header reads 举报群组; the body is otherwise the same.
- **Reason.** Choose one, for example `await page.click('loc=role:button[name="垃圾营销"]')`. The chosen option shows its selected state and the rest stay unselected.
- **Note.** Fill 备注 and read it back; the field is free text with no counter (unlike the feedback form's 60-character cap).
- **Proof.** Write `apps/website/.tmp/verify/report/report-user.aria.txt`, `report-group.aria.txt`, and `reason.json` with `{ options: 9, selected: "垃圾营销" }`. No submit means no write event is expected; say so rather than implying a successful report.

## Gotchas

- The two pages are nearly identical; the header is what tells them apart. A recipe that only checks the reason list passes against either one.
- The `id` query decides the target. A bare `#/report-user` still renders the form, so a run that forgets the parameter looks green while reporting nothing.
- 提交 submits a report about a real account or group. Treat it as a write, and verify only the form.
- The feedback form at `#/feedback` is a different page with a different reason list; see [help-and-feedback](./help-and-feedback.md).
