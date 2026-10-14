# Translation settings

Translation settings lists the friends, groups, and devices an account can translate for, each with its configured language pair, and opens the per-target editors — including the multi-language editor native launches directly.

## Sub-features

- `settings-index` offers 好友翻译设置, 群组翻译设置, 设备翻译设置.
- `friends-list` lists friends with `nick`, `微喇号`, and the `source → target` language pair.
- `friend-detail` edits one friend's mode: 关闭 / 中英互译 / 中英翻译 / 多语言翻译.
- `groups-list` lists translation-enabled groups, or 暂无群组。
- `group-members-settings` lists a group's members with their language pairs.
- `devices-list` lists smart devices with their model and IMEI.
- `multi-translation` edits a target's source/target languages in the multi-language mode.

## How to get to it (user POV)

- Home → 翻译设置 (`#/settings`), then one of the three rows (in-app links).
- Native launch URL: `/settings/friends/multi-translation` with `friend-id`, `friend-type`, and `friend-skill` — the only entry point in `docs/native/android/v5.0.4+504/entry-points.md` with an observed release value. A group variant exists at `/settings/groups/multi-translation` with `group-*` params.
- Open `#/settings/friends`, `#/settings/groups`, `#/settings/devices` directly.

## Driving it with ego-browser

Preconditions:

- `node .pi/skills/verify-vois-webview/scripts/doctor.mjs` exits 0.
- **Mode R**: the mock answers `接口不存在` for every `account/translate/*` call.
- For the friends journey, the captured response must hold at least one friend.

- **Open the index.** Run `await page.goto("http://localhost:3021/#/settings")`. Three rows appear: 好友翻译设置, 群组翻译设置, 设备翻译设置.
- **Friends.** Choose 好友翻译设置. The capture gains `POST /v2/account/translate/get-friends` with `errcode: 0`, and each row's text contains that friend's `nick`, `user_num`, and the `source → target` language names.
- **Agree with the capture.** The row count equals `responseBody.data.friends.length`.
- **Friend detail.** Choose a friend row. The URL becomes `#/settings/friends/<user_id>`, the header is the friend's `nick`, and `main` shows 微喇号 with the `user_num`, then the mode options 关闭 / 中英互译 / 中英翻译 / 多语言翻译. The capture gains `POST /v2/account/translate/get-friend`.
- **Groups.** Return to `#/settings` and choose 群组翻译设置 (`POST /v2/account/translate/get-groups`). `main` reads 暂无群组。 when the response holds zero groups, and rows otherwise.
- **Group members.** Run `await page.goto("http://localhost:3021/#/settings/groups/<groupId>/members")`. The header reads 群成员翻译设置 and the capture gains `POST /v2/account/translate/get-group-members`; when the account does not own the group, `main` shows 您不是群主, which is the observed state.
- **Devices.** Choose 设备翻译设置 (`POST /v2/account/get-smart-devices`); each row shows the device's model and IMEI.
- **Multi-translation, unsupported target.** Run `await page.goto("http://localhost:3021/#/settings/friends/multi-translation")` with no query. `main` reads 未找到该会话。 with a 重试 action. With `?friend-id=<id>` but no `friend-skill`, it reads 暂不支持该翻译模式 — a missing param is not treated as `0`.
- **Multi-translation, supported target.** Use a friend whose `user_id` came from the capture: `await page.goto("http://localhost:3021/#/settings/friends/multi-translation?friend-id=<user_id>&friend-type=2&friend-skill=3")`. The header reads 互译设置 (the AI-translator title; without `friend-type=2` it reads 翻译设置), the target's `nick` and 微喇号 render, and 源语言 / 目标语言 show the stored pair above the 全部语言 list. `friend-skill=0` opens the translation-off editor instead.
- **Proof.** Write `apps/website/.tmp/verify/translation-settings/mode-R/friends.aria.txt`, `.png`, `multi.aria.txt`, and `agreement.json` with `{ friends: N, apiFriends: N, userNum: "<num>", pair: "<src> → <tgt>" }`. Record which of groups/devices the run covered.

## Gotchas

- **`friend-id` is the friend's `user_id` (194343), not the 微喇号 shown on screen (10300097).** The wrong id renders 权限受限, which reads like a permission problem and is really a wrong parameter. Same for groups: `group-id` is the `group_id`, not the 群号.
- Rows on the friends list are buttons, not links; an `a[href]` assertion finds nothing.
- 暂无群组。 is data-dependent: assert it only when the captured response returns zero groups, and assert rows when it does not.
- Multi-translation is the one page native launches with parameters, so the params are part of the contract: missing `friend-skill` and any skill other than `0` or `3` both render 暂不支持该翻译模式. Test at least the supported and the unsupported case.
- `friend-skill=3` is the multilingual skill; skills 1 and 2 (the Chinese-English editors) have their own page, so passing them here is a caller bug, not a page bug.
- Language names come from i18n and follow the header language switcher; the default is 简体中文.
- The 全部语言 list is long and rendered from `get-countries-lang`; assert the current pair, not the list length.
