# Help and feedback

The help index lists the static help entries and the two contact paths; the feedback form collects a category and up to 60 characters; the report form collects a problem type and a description.

## Sub-features

- `help-index` shows 手机平台挂后台帮助, 联系我们, 提交反馈, 报告问题.
- `help-guide-open` opens `#/help-guide`.
- `feedback-open` opens `#/feedback`; `report-open` opens `#/report`.
- `feedback-category` selects one of 通用 / 聊天 / 设备 / 设计 / 连接 / 账户.
- `feedback-cap` truncates the description at 60 characters and counts what remains.

## How to get to it (user POV)

- Home → 帮助中心 (`#/help`).
- Open `#/help`, `#/help-guide`, `#/feedback`, or `#/report` directly.

## Driving it with ego-browser

Preconditions:

- `node .pi/skills/verify-vois-webview/scripts/doctor.mjs` exits 0.
- Neither form may be submitted: both write to the real backend for the debug account.

- **Help index.** Run `await page.goto("http://localhost:3021/#/help")`. The header reads 帮助 and `main` shows 手机平台挂后台帮助 under a heading, 联系我们, and the buttons 提交反馈 and 报告问题.
- **Help guide.** Choose 手机平台挂后台帮助. The URL becomes `#/help-guide` and the header reads 手机平台挂后台帮助.
- **Feedback form.** Return to `#/help` and choose 提交反馈. The URL becomes `#/feedback`; the screen shows the headings 类别 and 您的反馈, six category buttons, `css:textarea[placeholder="告诉我们您的想法。"]`, the counter `0/60`, and 提交.
- **Category.** Choose 设备. That button's class list contains `chip-selected` and the previously selected one carries `chip-unselected`; 通用 is the default. The counter does not change.
- **Cap.** Fill the textbox with more than 60 characters, for example `page.fill('css:textarea[placeholder="告诉我们您的想法。"]', 'x'.repeat(120))`. `document.querySelector('textarea').value.length` is 60 and the counter reads `60/60`.
- **Report form.** Return to `#/help` and choose 报告问题. The URL becomes `#/report`; the headings read 问题类型 and 发生了什么问题？ with the counter `0/60` and the button 报告.
- **Proof.** Write `apps/website/.tmp/verify/help-and-feedback/help.aria.txt`, `feedback.aria.txt`, `feedback.png`, and `cap.json` holding `{ "typed": 120, "accepted": 60, "counter": "60/60" }`. No submit means no write event is expected; say so in the run notes instead of implying success.

## Gotchas

- 提交 and 报告 are enabled with an empty textbox, so enabled state is not a validity signal.
- The selected category is expressed by `chip-selected` / `chip-unselected` classes, not `aria-pressed`; there is no ARIA selected state to assert.
- The counter is a separate node from the textbox: assert the cap on `textarea.value.length` and the user-visible number on the counter.
- `#/help-guide` renders its article outside `main`; read the header for the screen title and the document body for the text.
- The shared browser profile carries a translation extension whose toolbar (扇贝翻译, 选区翻译, 高亮单词, 语境测词, 禅模式, 自定义工具栏) appears in every snapshot. Ignore those nodes.
