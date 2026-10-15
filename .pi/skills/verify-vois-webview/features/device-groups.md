# Device groups

A device's group page lists the groups it created and joined, and leads to a group's detail, its members, and the two ways to add a group.

## Sub-features

- `groups-created` lists 我创建的 with each group's name and 微喇号.
- `groups-joined` lists 我加入的.
- `groups-add-entry` offers 从管理员通讯录添加 and 按条件查找添加.
- `groups-open` opens the group detail.
- `group-detail` shows 群号, 群名, 群昵称, the member count, and 解散群组.
- `group-members` lists 群管理员 and the members, with 搜索成员 and 添加成员.
- `groups-add-list` lists 可直接加入的群组 and 需审批的群组 from the manager address book.
- `groups-search` searches a group by 群号.

## How to get to it (user POV)

- Device detail → 群组管理 (in-app link).
- Open `#/devices/<id>/groups` directly; native deep-links device pages this way.
- From the groups page: 从管理员通讯录添加 → `/groups/add`, 按条件查找添加 → `/groups/search`.
- From a group row → `/groups/<groupId>`; from its 群成员列表 → `/groups/<groupId>/members`.

## Driving it with ego-browser

Preconditions:

- The device-detail preconditions, plus a device id that owns or joined at least one group.
- These pages answer from the real `subuser/*` endpoints.

- **Open.** From device detail choose 群组管理, or run `await page.goto("http://localhost:3021/#/devices/<id>/groups")`. The capture gains `POST /v2/subuser/group-get-all` with `errcode: 0`, and the header reads 群组管理.
- **Read the sections.** `main` shows 我创建的 and 我加入的; each group row is a button whose text contains that group's `name` and `num`.
- **Agree with the capture.** Rows under 我创建的 match `responseBody.data.groups` entries with `is_creator: true`, and rows under 我加入的 match the rest. An empty heading with groups in the response is the finding.
- **Add entries.** Both links exist: `loc=role:link[name="从管理员通讯录添加"]` with href `#/devices/<id>/groups/add`, and `loc=role:link[name="按条件查找添加"]` with href `#/devices/<id>/groups/search`.
- **Add list.** Choose 从管理员通讯录添加. The header reads 从管理员通讯录添加, the capture gains `POST /v2/subuser/manager-get-all-group`, and `main` splits into 可直接加入的群组 (无 when empty) and 需审批的群组, where a group the device already joined carries 已加入.
- **Search.** Choose 按条件查找添加: the header reads 按条件查找添加, `main` shows 搜索 and 请输入群号进行搜索。, and no call is made until the search runs.
- **Group detail.** Choose a group row. The URL becomes `#/devices/<id>/groups/<groupId>`, the header is the group name, and `main` shows 群号, 群名, 群昵称 (暂未设置 when unset), `群成员列表(N 人)`, and 解散群组.
- **Members.** From the group detail choose 群成员列表. The URL becomes `#/devices/<id>/groups/<groupId>/members`, the header reads 群成员, and `main` shows 搜索成员, 添加成员, a 群管理员 section, and one row per member with its `nick` and 微喇号. The capture gains `POST /v2/subuser/group-member-get-all`.
- **Proof.** Write `apps/website/.tmp/verify/device-groups/mode-R/groups.aria.txt`, `groups.png`, `detail.aria.txt`, `members.aria.txt`, and `agreement.json` with `{ created: N, joined: M, apiGroups: N + M, memberCount: N }` — counts only, no member names.

## Gotchas

- **The group detail also calls `POST /v2/group/info`, which answers HTTP 404 against the real API, and still renders correctly** from `subuser/*`. A 404 in the capture is not automatically a broken screen; check whether the page filled in before reporting a product gap.
- Two groups can share a display name. Address a row by name plus 微喇号, or by the URL it opens.
- `group-get-all` is scoped by the device's `user_id`; this is not the account-wide list at `#/settings/groups` (different page, different call).
- With no groups the empty state replaces the rows and both headings may render empty; report that state as observed and skip the row assertions rather than inventing a group.
- 解散群组 and 添加成员 are writes against real groups; verifying them needs an isolated backend, which this page does not currently have.
