# Bluetooth activation

The QR sheet renders one code per Bluetooth AI-translate unit, and each code opens the activation page that binds the headset to an account.

## Sub-features

- `sheet-render` renders the batch of codes, one QR per unit, labelled with its uuid.
- `activate-missing-code` tells the user when the link carries no activation code.
- `activate-info` shows the code's status, its deadline, and the account it is bound to.
- `activate-confirm` binds the code to the signed-in account.

## How to get to it (user POV)

- `#/qrcode-scan` is the sheet itself: a printable page, not linked from anywhere in the SPA.
- Scanning a code opens `#/shared/qrcode/bluetooth-ai-translate-active?uuid=<uuid>` inside the App; `docs/native/android/v5.0.4+504/entry-points.md` lists "scanned `/shared/qrcode…` URL" as a native entry point.

## Driving it with ego-browser

Preconditions:

- No backend needed for the sheet; the activation page needs mode R (it queries the code and the account).
- Do not confirm an activation unless the run is about binding hardware.

- **Sheet.** Run `await page.goto("http://localhost:3021/#/qrcode-scan")`. The header reads `QR code scan` (the one English header in the app) and `main` holds one `img` per code, each with the uuid as its `alt` text and as its `figcaption`. The codes are a hardcoded batch in the page source, so the count is stable.
- **Agree with the sheet.** Every `img[alt]` is a uuid and its caption matches its `alt`; there are no duplicated uuids. Reading a code's target is not possible from the DOM — the QR is a data URL — so the mapping is asserted through the next step.
- **Missing code.** Run `await page.goto("http://localhost:3021/#/shared/qrcode/bluetooth-ai-translate-active")` with no query. The header reads 激活蓝牙耳机翻译 and `main` reads 该链接缺少激活码。with a 重试 action, and no code query is made.
- **With a code.** Append a uuid from the sheet: the header is 激活蓝牙耳机翻译 and `main` shows 蓝牙耳机翻译使用期一年, the status (已激活 or the activate-before date), 绑定账号信息 with 微喇号 and 昵称, and 激活码 echoing exactly the uuid that was passed.
- **Proof.** Write `apps/website/.tmp/verify/bluetooth-activation/sheet.png`, `sheet.json` with `{ codes: 20, unique: 20, firstCode: "<uuid>" }`, and `activated.aria.txt` for one code. The screenshot is the proof for the sheet: the codes are images.

## Gotchas

- The activation page treats the query as the source of truth for the code, so a wrong uuid silently inspects a different unit. Assert 激活码 equals the uuid passed.
- Loading the page is read-only (it queries the code and the signed-in account); confirming the activation writes a binding to a real unit. Verify the info card, and only confirm when the run is explicitly about binding.
- An already-activated code shows the bound account; a fresh code shows the activate-before date. Both are pass states — assert the structure and the echoed code, not one specific status.
- The sheet has no in-app entry point; a run that depends on clicking through the app cannot reach it.
