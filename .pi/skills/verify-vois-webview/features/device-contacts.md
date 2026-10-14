# Device contacts

A device's contact page lists the people added to that device and offers two ways to add more. The emergency-contact page manages the SOS list, its quota, and the two ways to add someone.

## Sub-features

- `contacts-list` lists added contacts with nickname, 微喇号, and online state, or its empty state.
- `contacts-add` lists the account's friends, marks the ones already added, and adds the selected ones.
- `contacts-search` searches by 微喇号 before adding.
- `emergency-list` shows the 温馨提示, the remaining SOS call quota, and the current emergency contacts.
- `emergency-add` offers 添加好友 and 添加电话联系人.

## How to get to it (user POV)

- URL-only routes (`contacts`, `contacts/add`, `contacts/search`, `emergency-contacts`, `emergency-contacts/add-friend`, `emergency-contacts/add-phone`): nothing in this repo links them and the documented native entry points do not list them. They render, but no user path to them is proven.
- Inside the contacts page, 从好友添加 and 搜索并添加 are in-app links.

## Driving it with ego-browser

Preconditions:

- **Mode M.** In mode R every screen here renders 无法连接服务器，请检查网络后重试。 because `device/contacts`, `device/emergency-contacts`, and `friend/list` answer HTTP 404.
- A mock device id: `101` (工作手机) or `102` (备用手机). These pages must be entered by URL, because the device list in mode M still answers from the real API and shows the real fleet.

- **Contacts list.** Run `await page.goto("http://localhost:3021/#/devices/101/contacts")`. The capture gains `POST /v2/device/contacts` with `errcode: 0`; the header reads 联系人管理 and `main` shows 从好友添加, 搜索并添加, 已添加联系人, then one row per `responseBody.data.contacts` entry, each with its `nick` and `user_num`.
- **Agree with the capture.** The number of contact rows equals `responseBody.data.contacts.length`. With an empty list the 已添加联系人 section renders without rows.
- **Add from friends.** Choose 从好友添加. Run `await page.click('loc=role:link[name="从好友添加"]')`. The URL becomes `#/devices/101/contacts/add` and the capture gains `POST /v2/friend/list`. Each friend row shows its `nick` and `user_num`, and a friend already on the device carries 已添加; 全选 and the "添加 N 位联系人" count follow the selection.
- **Search.** From the contacts page choose 搜索并添加 (`#/devices/101/contacts/search`): 请输入微喇号进行搜索。with a 搜索 action, and no call until it is used.
- **Emergency list.** Run `await page.goto("http://localhost:3021/#/devices/101/emergency-contacts")` (`POST /v2/device/emergency-contacts`, `errcode: 0`). The page shows 温馨提示 with the two limits (3 friends, 2 phone numbers), 剩余SOS紧急电话通知次数为 5, the current contacts, and the buttons 添加好友 and 添加电话联系人.
- **Emergency add entries.** Choose each: 添加好友 opens `#/devices/101/emergency-contacts/add-friend`, 添加电话联系人 opens `#/devices/101/emergency-contacts/add-phone`.
- **Proof.** Write `apps/website/.tmp/verify/device-contacts/mode-M/contacts.aria.txt`, `.png`, `emergency.aria.txt`, and a `capture.json` holding only `{ endpoint, errcode, contacts: [{ nick, user_num }] }` for each call. Do not copy the whole `responseBody`.

## Gotchas

- Mode R is not a driver failure: the endpoints are gone from the real API and the screen says so. If the task is "does this page work against the real backend", the answer is no, and the proof is the 404 plus the error state.
- Adding a contact is a mock write. It mutates the server's in-memory fixture, so later runs in the same mock process may see the contact you added; restart the mock server to reset.
- Mode M's device list and these pages disagree about which devices exist (real ids vs `101`/`102`). Enter by URL rather than clicking through.
- The two add pages render inside the same header title as their parent (从好友添加, 紧急联系人设置), so read the URL, not the header, to tell them apart.
