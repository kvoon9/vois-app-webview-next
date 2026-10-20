# Device contacts

A device's contact page lists the people added to that device and offers two ways to add more; the emergency-contact page manages the SOS list, its quota, and the two ways to add someone.

## Sub-features

- `contacts-list` lists the device's friends with the device's remark (or `nick`) and 微喇号, or its empty state. Friend endpoints carry no `online` field, so rows show no presence dot.
- `contacts-add` lists the account's friends, marks the ones already added, and invites the selected ones.
- `contacts-search` searches 微喇号 before inviting.
- `contacts-detail` shows one contact with 注册时间, 备注, and 删除联系人. `friend-get-all` has no `signature`, so the 签名 row is gone.
- `emergency-list` shows the 温馨提示, the remaining SOS call quota, and the current emergency contacts.
- `emergency-add-friend` adds one of the account's friends to the SOS list.
- `emergency-add-phone` adds a raw phone entry to the SOS list.

## How to get to it (user POV)

- Device detail → 联系人管理 (in-app link) → `#/devices/<id>/contacts`.
- Device detail → 紧急联系人设置 (in-app link) → `#/devices/<id>/emergency-contacts`.
- From the contacts page: 从好友添加 → `#/devices/<id>/contacts/add`, 搜索并添加 → `#/devices/<id>/contacts/search`, and a contact row → `#/devices/<id>/contacts/<contactId>`.
- From the emergency page: 添加好友 → `#/devices/<id>/emergency-contacts/add-friend`, 添加电话联系人 → `#/devices/<id>/emergency-contacts/add-phone`.
- Open any of these by URL directly; native may deep-link this way.

## Driving it with ego-browser

Preconditions:

- The device-detail preconditions, plus a real device id from the manager list (for example `1848581`).
- The real API is the only backend. Contacts use `friend-get-all`, `friend-search-user`, `friend-invite`, `friend-delete`, and `friend-change-remark`; SOS uses `emergency-contact-get`, `-add-friend`, `-add-phone`, and `-delete`; the add picker reads the account's own friends from `manager-get-all-friend`.

- **Contacts list.** Run `await page.goto("http://localhost:3021/#/devices/1848581/contacts")`. The header reads 联系人管理 and the capture gains `POST /v2/subuser/friend-get-all` with `errcode: 0`. `main` shows 从好友添加 and 搜索并添加, then 已添加联系人 with one row per `responseBody.data.friends` entry; each row shows the device's remark (or `nick`) and its `user_num`. An empty list renders 暂无联系人。
- **Agree with the capture.** The number of contact rows equals `responseBody.data.friends.length`; a row's name is `remark || nick`.
- **Add from friends.** Choose 从好友添加. The URL becomes `#/devices/1848581/contacts/add`; the capture gains `POST /v2/subuser/manager-get-all-friend` (the picker) and `POST /v2/subuser/friend-get-all` (to mark 已添加). Each row shows its `nick` and `user_num`, a friend already on the device carries 已添加, and 全选 plus the "添加 N 位联系人" count follow the selection.
- **Add (write).** Confirming the picker calls `POST /v2/subuser/friend-invite` once per selected friend with body `{ user_id, invitee_id, detail }`. Stop at the confirmation; see Gotchas.
- **Search.** From the contacts page choose 搜索并添加 (`#/devices/1848581/contacts/search`): 请输入微喇号 with a 搜索 action, and no call until it is used. Submitting runs `POST /v2/subuser/friend-search-user` with body `{ user_id, key }`; the results are `responseBody.data.users`. Choosing a result opens the application dialog with an editable reason (default 我想添加你为好友。); confirming runs `friend-invite`.
- **Contact detail.** Choose a contact row (`#/devices/1848581/contacts/<contactId>`); the page resolves it from `friend-get-all`. The header is the contact's name; `main` shows 注册时间, 签名, 备注 (edit runs `friend-change-remark` with `{ user_id, friend_id, remark }`), and 删除联系人 (runs `friend-delete` with `{ user_id, friend_id }`). The 备注 editor starts from `remark`, not from the display name.
- **Emergency list.** Run `await page.goto("http://localhost:3021/#/devices/1848581/emergency-contacts")` (`POST /v2/subuser/emergency-contact-get`, `errcode: 0`). The header reads 紧急联系人设置 and the page shows 温馨提示 with the two limits (微喇好友最大数量 `sos_friend_limit`, 手机号最大数量 `sos_phone_limit`), 剩余SOS紧急电话通知次数为 `<sos_times>`, the current contacts, and the buttons 添加好友 and 添加电话联系人. Both stay tappable when their quota is full and answer with a 最多可添加 N 个… toast, as native does.
- **Emergency add entries.** Choose each: 添加好友 opens `#/devices/1848581/emergency-contacts/add-friend`, 添加电话联系人 opens `#/devices/1848581/emergency-contacts/add-phone`.
- **Emergency add (write).** add-friend lists `manager-get-all-friend` with already-added rows marked 已添加; choosing one runs `emergency-contact-add-friend` with `{ user_id, friend_id }`. add-phone takes a name and a phone and runs `emergency-contact-add-phone` with `{ user_id, name, number }`.
- **Emergency remove (write).** The − action on a contact row runs `emergency-contact-delete` with `{ user_id, number, type }` (`type` 1 for phone, 2 for friend). Deletion is keyed by number plus kind, not by an id.
- **Proof.** Write `apps/website/.tmp/verify/device-contacts/contacts.aria.txt`, `contacts.png`, `emergency.aria.txt`, and `agreement.json` holding only `{ endpoint, errcode, count }` per call. Do not copy a whole `responseBody`.

## Gotchas

- Every add, remove, and remark call is a write on production data: `friend-invite`, `friend-delete`, `friend-change-remark`, `emergency-contact-add-friend`, `emergency-contact-add-phone`, `emergency-contact-delete`. Verify by safe observation — the request the confirm builds, the 已添加 marker, the disabled state, the validation message — and stop at the confirmation unless the run is explicitly about the write.
- A device friend is keyed by `user_id`; an emergency contact is keyed by `number` plus `type` (a friend's `number` is the Weila number, a phone's is the phone). Deletion carries no id.
- The contacts add and search pages look alike; read the URL or the header (从好友添加 vs 搜索并添加) to tell them apart. The emergency friend picker is entered from 添加好友.
- 消息免打扰, 共享我的位置, 文字和语音播报, and 清空聊天记录 no longer exist on the contact detail. Do not look for them; there is no endpoint behind them.
- Judge by `errcode`, not HTTP status. An empty list is a valid `errcode: 0` with an empty `friends` array.
