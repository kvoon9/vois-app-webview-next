# Known backend issues

## Friend remark cannot be cleared

`POST /v2/subuser/friend-change-remark` rejects an empty `remark` with `20 参数错误`, while the sibling `group-member-change-remark` accepts the same empty value and clears the card name. The client editor allows clearing, and `friend-get-all` falls back with `remark || nick`, so an empty remark is a legitimate state. Treat the empty-value failure as a backend bug, not a client validation gap.

Verbatim capture, 2026-11-11, DevServer proxied to the real API:

```
好友备注，空值：

POST /v2/subuser/friend-change-remark
{"user_id":1683740,"friend_id":1541034,"remark":""}
=> {"errcode":20,"errmsg":"参数错误"}

好友备注，非空对照：

POST /v2/subuser/friend-change-remark
{"user_id":1683740,"friend_id":1541034,"remark":"123"}
=> {"errcode":0,"errmsg":"请求成功"}

群名片，同样的空值：

POST /v2/subuser/group-member-change-remark
{"user_id":1631010,"group_id":33810,"remark":""}
=> {"errcode":0,"errmsg":"请求成功"}
```

The group save leaves 群昵称 as 暂未设置 and shows 群组已更新。

### Additional behavior

- `remark: null` and an omitted `remark` also answer `20 参数错误`.
- `remark: " "` is accepted and stored as a space. The list uses `remark || nick`, so the space is truthy and renders a blank name.
- Both API documents mark `remark` required, but the group endpoint accepts an empty value, so the documents do not explain the difference.

### Do not

- Do not add `required` to the remark editor. That hides the backend inconsistency and was tried in PR #12, then reverted in `5502e75`.
- Do not submit a space or the friend's nick as a workaround. A space renders a blank name; the nick drifts when it changes.

### Reproduce

UI: `#/devices/1683740/contacts/1541034` → 备注 → clear → 确认. The toast reads 参数错误.

Comparison: `#/devices/1631010/groups/33810` → 群昵称 → set, save, clear, save. The save succeeds.
