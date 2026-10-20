# Device contacts

A device's contact page offers the two add entries in one card and lists the friends already on the device in a 已加入 card; the emergency-contact page manages the SOS list, its quota, and the two ways to add someone.

## Sub-features

- `contacts-list` shows the 已加入 card with one row per friend (avatar and the device's remark, or `nick`). The empty card stays blank — 暂无联系人。 is screen-reader text only — and rows carry no presence dot or 微喇号 subtitle.
- `contacts-add` (从通讯录添加) lists the account's friends in pinyin order behind a 搜索联系人 field, marks the ones already added 已添加, and invites the selected ones.
- `contacts-search` (按条件查找添加) searches 微喇号 / phone before inviting.
- `contacts-detail` shows one contact with 注册时间, 备注, 举报, and 删除联系人. `friend-get-all` has no `signature`, so there is no 签名 row.
- `emergency-list` reads top to bottom: 温馨提示 (the two quotas and the remaining SOS call count, numbers in red), the 添加微喇联系人 / 添加电话联系人 card, then the 已加入 card with the current contacts.
- `emergency-add-friend` adds one of the account's friends to the SOS list, pinyin-ordered behind a 搜索联系人 field.
- `emergency-add-phone` adds a raw phone entry from a square illustration, two rounded inputs, a grey hint, and a full-width 保存.

## How to get to it (user POV)

- Device detail → 联系人管理 (in-app link) → `#/devices/<id>/contacts`.
- Device detail → 紧急联系人设置 (in-app link) → `#/devices/<id>/emergency-contacts`.
- From the contacts page: 从通讯录添加 → `#/devices/<id>/contacts/add`, 按条件查找添加 → `#/devices/<id>/contacts/search`, and a contact row → `#/devices/<id>/contacts/<contactId>`.
- From the emergency page: 添加微喇联系人 → `#/devices/<id>/emergency-contacts/add-friend`, 添加电话联系人 → `#/devices/<id>/emergency-contacts/add-phone`.
- Open any of these by URL directly; native may deep-link this way.

## Driving it with ego-browser

Preconditions:

- The device-detail preconditions, plus a real device id from the manager list (for example `1848581`).
- The real API is the only backend. Contacts use `friend-get-all`, `friend-search-user`, `friend-invite`, `friend-delete`, and `friend-change-remark`; SOS uses `emergency-contact-get`, `-add-friend`, `-add-phone`, and `-delete`; the add picker reads the account's own friends from `manager-get-all-friend`.

- **Contacts list.** Run `await page.goto("http://localhost:3021/#/devices/1848581/contacts")`. The header reads 联系人管理 and the capture gains `POST /v2/subuser/friend-get-all` with `errcode: 0`. `main` shows one card holding 从通讯录添加 and 按条件查找添加, then the 已加入 card with one row per `responseBody.data.friends` entry; a row shows the device's remark (or `nick`) only.
- **Agree with the capture.** The number of contact rows equals `responseBody.data.friends.length`, the rows follow the pinyin order of the names, and a row's name is `remark || nick`. With no friends the 已加入 card renders empty: no visible sentence, only a `sr-only` 暂无联系人。 node.
- **Add from friends.** Choose 从通讯录添加. The URL becomes `#/devices/1848581/contacts/add`, the header reads 从通讯录添加, and the capture gains `POST /v2/subuser/manager-get-all-friend` (the picker) and `POST /v2/subuser/friend-get-all` (to mark 已添加). The page opens with a 搜索联系人 field, then a 全选 row, then the friends in pinyin order (for example 95鸿蒙对讲 → 相约星期八 → 相约星期六 → 相约星期天); a friend already on the device carries 已添加 and cannot be selected, and the bottom action counts the selection as 添加 N 位联系人.
- **Add (write).** Confirming the picker calls `POST /v2/subuser/friend-invite` once per selected friend with body `{ user_id, invitee_id, detail }`. Stop at the confirmation; see Gotchas.
- **Search.** From the contacts page choose 按条件查找添加 (`#/devices/1848581/contacts/search`): a field reading 通过用户微喇号 手机号 搜索 and a 搜索 action, with 请输入微喇号或手机号进行搜索。 as the hint and no call until it is used. Submitting runs `POST /v2/subuser/friend-search-user` with body `{ user_id, key }`; the results are `responseBody.data.users`. Choosing a result opens the application dialog with an editable reason (default 我想添加你为好友。); confirming runs `friend-invite`.
- **Contact detail.** Choose a contact row (`#/devices/1848581/contacts/<contactId>`); the page resolves it from `friend-get-all`. The header is the contact's name; the block shows the avatar, the name, and its 微喇号; `main` shows 注册时间, the 备注 row (its second line is the current name; editing runs `friend-change-remark` with `{ user_id, friend_id, remark }`), 举报, and 删除联系人 (runs `friend-delete` with `{ user_id, friend_id }`). The 备注 editor starts from `remark`, not from the display name.
- **Emergency list.** Run `await page.goto("http://localhost:3021/#/devices/1848581/emergency-contacts")` (`POST /v2/subuser/emergency-contact-get`, `errcode: 0`). The header reads 紧急联系人设置 and the page reads, in this order: 温馨提示 with the two limits (微喇好友最大数量 `sos_friend_limit`, 手机号最大数量 `sos_phone_limit`) and 剩余SOS紧急电话通知次数为 `<sos_times>`, with those numbers in red; then the 添加微喇联系人 / 添加电话联系人 card; then the 已加入 card with the current contacts. Both entries stay tappable when their quota is full and answer with a 最多可添加 N 个… toast, as native does.
- **Emergency add entries.** Choose each: 添加微喇联系人 opens `#/devices/1848581/emergency-contacts/add-friend`, 添加电话联系人 opens `#/devices/1848581/emergency-contacts/add-phone`.
- **Emergency add (write).** add-friend (header 添加微喇联系人) lists `manager-get-all-friend` in pinyin order behind a 搜索联系人 field, with already-added rows marked 已添加; tapping one runs `emergency-contact-add-friend` with `{ user_id, friend_id }` and leaves the page. add-phone (header 添加电话联系人) shows the square illustration placeholder, the two rounded inputs (phone, then name), the grey hint 添加或修改紧急联系人后请及时告知对方, and the full-width 保存, which runs `emergency-contact-add-phone` with `{ user_id, name, number }`.
- **Emergency remove (write).** The − action on a contact row (`aria-label="删除紧急联系人"`) asks 确定要删除紧急联系人{name}吗？ (with the contact's name filled in) and runs `emergency-contact-delete` with `{ user_id, number, type }` (`type` 1 for phone, 2 for friend). Deletion is keyed by number plus kind, not by an id.
- **Proof.** Write `apps/website/.tmp/verify/device-contacts/contacts.aria.txt`, `contacts.png`, `emergency.aria.txt`, and `agreement.json` holding only `{ endpoint, errcode, count }` per call. Do not copy a whole `responseBody`.

## Gotchas

- The 已加入 card is blank when it is empty: 暂无联系人。 is `sr-only`, so an empty card is the current design, not a render failure. The same applies to the emergency 已加入 card.
- There is no A–Z index on the contacts list or the pickers: the ordering is pinyin (`localeCompare(..., 'zh-Hans-CN')`) with no index rail, and the letter the old app drew is intentionally absent.
- Rows show the name only: the 微喇号 subtitle was dropped from the contacts list, the contacts picker, and the SOS friend picker. Do not fail a row for missing `user_num`; the search field still matches a `user_num` (and a nick).
- The two add entries live in one card (从通讯录添加 / 按条件查找添加) and the SOS pair in another (添加微喇联系人 / 添加电话联系人); the copy 从好友添加, 搜索并添加, and 添加好友 is gone.
- Every add, remove, and remark call is a write on production data: `friend-invite`, `friend-delete`, `friend-change-remark`, `emergency-contact-add-friend`, `emergency-contact-add-phone`, `emergency-contact-delete`. Verify by safe observation — the request the confirm builds, the 已添加 marker, the disabled state, the validation message — and stop at the confirmation unless the run is explicitly about the write.
- A device friend is keyed by `user_id`; an emergency contact is keyed by `number` plus `type` (a friend's `number` is the Weila number, a phone's is the phone). Deletion carries no id.
- The contacts add and search pages look alike; read the URL or the header (从通讯录添加 vs 按条件查找添加) to tell them apart. The emergency friend picker is entered from 添加微喇联系人 and shares the 搜索联系人 field.
- 消息免打扰, 共享我的位置, 文字和语音播报, and 清空聊天记录 do not exist on the contact detail. Do not look for them; there is no endpoint behind them.
- Judge by `errcode`, not HTTP status. An empty list is a valid `errcode: 0` with an empty `friends` array.
