# Account switching

The home screen lists the accounts saved in this browser, marks the current one, and links to a sign-in page for an external account.

## Sub-features

- `home-accounts` lists saved accounts with nickname, 微喇号, and account type.
- `home-current` marks the account in use with 当前帐号.
- `home-add-entry` links to the sign-in page.
- `login-form` collects 帐号／手机号 and 密码 and offers 登录.

## How to get to it (user POV)

- `#/` is the app root: native opens it in debug builds, and it is where the webview lands.
- 添加账号 on the home screen links to `#/login`. The link only renders in dev or under the debug server (`import.meta.env.DEV || isWebviewDebug()`), so production hides it.

## Driving it with ego-browser

Preconditions:

- **Mode R**: the account list renders from whatever the browser stored plus `POST /v2/user/get-my-user-info`; the mock answers `接口不存在` for that endpoint.
- The shared profile is already signed in as the debug account; do not sign out or switch accounts to make a journey pass.

- **Home account list.** Run `await page.goto("http://localhost:3021/#/")`. The header reads 导航, the section heading 已登录帐号 lists each saved account with `nick`, `user_num` and the App 账号 tag, and the one in use carries 当前帐号. When the profile is already cached this page makes no call — that is expected, not a missing fetch.
- **Agree with the capture.** When `POST /v2/user/get-my-user-info` appears in the capture, its `responseBody.data` user id matches the marked account.
- **Add-account entry.** Run `await page.click('loc=role:link[name="添加账号"]')`. The URL becomes `#/login`, the header reads 登录, and the form shows 帐号／手机号, 密码, and 登录.
- **Form only.** The form makes no call until 登录 is chosen; filling the fields is a safe observation.
- **Proof.** Write `apps/website/.tmp/verify/account-switching/mode-R/home.aria.txt`, `home.png`, `login.aria.txt` with the account nickname only — never the token, the password field's value, or the full `user_num` if the run notes are shared outside the machine.

## Gotchas

- Signing in is a session write: it re-signs the account on the TCP gateway and changes which account the page serves. Do not submit the login form during verification; the form's fields and the home list are what a read-only run can prove.
- The saved-account list lives in browser storage, not in an API response, so a fresh profile shows fewer accounts and the list is not reproducible across machines.
- Account tokens are tab-scoped (`sessionStorage`), so a new tab can be signed out while this one is signed in. Do not "fix" that by clearing storage.
- The 添加账号 link is dev/debug-only; its absence in a production build is correct behaviour, not a regression.
