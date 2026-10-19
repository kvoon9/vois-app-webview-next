---
description: 'The permission bridge added in App build 10191150: `get-permissions` contract, the permission dialog flow it exposes, and the stranded-dialog trap the H5 must design around.'
navigation:
  title: 'Permission bridge'
---

# Permission bridge — `get-permissions`

Provenance: `com.voistech.chat.ui.web.bridge.WebPermissionBridge`,
`com.voistech.chat.utils.PermissionUtil` and `BridgeType` in artifact
`android-5.0.8+508` build `10191150` (`vender/WL_V5.0.8_Code508_10191150.apk`,
sha256 `87aeb949dd698cecc5a99c51f6a72a0b007b9c7f96fcb6b72736907c45cee440`,
same versionName 5.0.8 / versionCode 508 as the earlier `10151723` build).
Decompiled with jadx 1.5.6; only the classes named here were inspected, so
"the only change" claims do not extend past them.

`BridgeType` gains exactly one new message over the `10151723` build:
`get-permissions`. There is still **no** open-app-settings message; the
closest native offers is the dialog button described below, which jumps
without ever telling the webview.

## Contract

Request `data`:

| field    | type             | meaning                                                    |
| -------- | ---------------- | ---------------------------------------------------------- |
| `params` | `string[]?`      | group names to query; omitted or empty answers every group |

Group names (`WebPermissionBridge.GROUPS`): `location`,
`background-location`, `audio-recording`, `camera`, `nearby-devices`,
`notification`. An unknown name is silently skipped — it produces no key in
the answer, so absent ≠ denied; the H5 should request `['location']` and read
that key.

Response: always `errcode: 0`, one boolean per resolved group:

```json
{ "type": "get-permissions", "errcode": 0, "errmsg": "", "data": { "location": false } }
```

- Runtime permissions (`PermissionUtil.isHasPermissions`): every permission in
  the group must be granted (`ACCESS_FINE_LOCATION` **and**
  `ACCESS_COARSE_LOCATION` for `location`).
- `notification` reads `NotificationManagerCompat.areNotificationsEnabled()`
  instead.
- The query never raises a dialog and never blocks: it is a pure state read.

## What the H5 must design around — the stranded dialog

`start-location` on a missing permission goes through
`PermissionUtil.requestPermissions`, which picks a flow from its persisted
status (`ConfigManager`, survives restarts):

1. First ask: banner + the system permission dialog; answers `0`/`1001`.
2. Denied once: a "确定"-style rationale dialog, then the system dialog.
3. Persistently denied (`shouldShowRequestPermissionRationale` false):
   `showPermissionDeniedDialog` — a **not-cancelable** app dialog titled
   需要权限 (`permission_dialog_title`) with the single button 去设置
   (`permission_go_settings`).

The trap is in flow 3. The dialog's result listener posts `false` only when
the confirm action is absent; tapping 去设置 instead calls
`openAppDetailSettings` (jumps to the system app-info page) and **never posts
to the LiveData**. Consequences observed in `WebLocationBridge`:

- The suspended `start-location` never answers. An H5 waiting on it hangs
  until its own timeout.
- `WebLocationBridge.requestingPermission` stays `true` forever, so **every**
  later `start-location` — even after the user really grants in settings —
  answers `-1 "location permission request in progress"` until the activity is
  recreated.

The product contract accepts this trap knowingly: H5 still sends
`start-location` unconditionally so native's dialog chain (including this
dialog) stays the permission UX. The stranded round is absorbed by the H5's
90s leash into a retryable error state, and every refocus runs a fresh round.
One residue to expect: after a 去设置 jump, the stuck `requestingPermission`
flag makes even a really-granted next `start-location` answer
`-1 "location permission request in progress"` until the activity is
recreated; the bounded retry surfaces that as the same retryable error state.
`get-permissions` never gates a call; it only labels the wait in the UI.

## H5 side

`apps/website/src/utils/bridge/location-bridge.ts` declares the
`get-permissions` types (`BridgePermissionName`, `GetPermissionsResponse`);
`useRealtimeLocation` probes it on every start round for the UI label only.
