---
description: 'The realtime location bridge added in 5.0.8: `start-location` / `get-location` contract, session lifecycle, error codes, and what the fix actually is.'
navigation: 
  title: 'Location bridge'
---

# Location bridge — `start-location` / `get-location`

Provenance: `com.voistech.chat.ui.web.bridge.WebLocationBridge`,
`com.voistech.chat.ui.web.VoisWebActivity` and `com.voistech.chat.ui.web.bridge.BridgeType`
in artifact `android-5.0.8+508` (see `docs/native/index.json`; package
`vender/WL_V5.0.8_Code508_10151723.apk`, 5.0.8 / code 508, flavor `baseCn`,
debug build). Everything here is observed from the package. Build `10191150`
of the same version adds `get-permissions` on top — see
[permission-bridge.md](/native/android/v5.0.8+508/permission-bridge) for that
contract and the stranded-dialog behavior that shapes the H5 flow below.

This is the one functional bridge change in 5.0.8 over 5.0.4: `BridgeType.java`
gains `start-location` and `get-location`. Transport, dispatch and the response
envelope are unchanged — see
[bridge-protocol.md](/native/android/v5.0.4+504/bridge-protocol). One request,
one callback answer; still no native-to-H5 events or pushes.

Registration sits in `VoisWebActivity#registerBridgeHandlers`
(`VoisWebActivity.java:293-295`): the activity owns a single `WebLocationBridge`
and maps both types onto it. It also forwards its own lifecycle to the bridge:
`onResume` → `onHostResume` (`:381-383`), `onPause` → `onHostPause`
(`:392-394`), `onDestroy` → `release` (`:399-403`).

## Contract

### `start-location` — open a bounded GPS session

Request `data`:

| field    | type | meaning                                    |
| -------- | ---- | ------------------------------------------ |
| interval | int  | poll period in ms; floored at 5000         |
| time     | int  | session length in ms; clamped 15000-60000  |

Both fields are required and must be positive integers
(`readPositiveInt`, `WebLocationBridge.java:173-189`); a missing, non-numeric,
zero or negative value answers `-1 "invalid interval/time"` (`:86-90`).

Response `data` echoes the values **after clamping** (`sessionData`,
`:192-197`), so the H5 never has to guess what native actually applied:

```json
{ "interval": 5000, "time": 30000 }
```

Clamping (`:92-93`, constants at `:20-22`): `interval = max(5000, interval)`,
`time = clamp(time, 15000, 60000)`.

### `get-location` — read the last fix

Request `data`: `{}` (ignored).

Response `data` (`handleGetLocation`, `:130-140`):

```json
{
  "coordType": "gcj02",
  "location": {
    "latitude": 22.6305,
    "longitude": 114.0668,
    "altitude": 12.0,
    "accuracy": 30.0,
    "speed": 1.2,
    "bearing": 90.0,
    "time": 1791954485000,
    "name": "",
    "address": ""
  }
}
```

- `coordType` is `"gcj02"` on the `baseCn` flavor, `"wgs84"` otherwise
  (`coordType`, `:199-202`). The decompiler shows the flavor check
  constant-folded (`"baseCn".equals("baseCn")`); every package in this line is
  `baseCn`, so expect `"gcj02"`.
- `location` is the last known fix, or `null` before the first fix arrives
  (`:135-138`). Fields as written by `locationJson` (`:204-214`); `time` is ms
  since epoch. The H5 types treat the numeric fields as nullable.
- `get-location` never triggers a fix; it only reads what the running session
  has already produced.

## Session lifecycle

- One `start-location` arms a one-shot timer for `time` ms (`startSession`,
  `:121-128`; `armSessionTimer`, `:142-152`). There is **no stop message**.
  When the timer hits zero the session stops itself (`:158-159`) and later
  `get-location` calls answer `-1 "location not running"` (`:131-133`).
- A `start-location` while a session is running restarts it in place: the new
  timer replaces the old one and the old timer's expiry is ignored
  (`lambda$armSessionTimer$2`, `:154-156`). This is the renewal mechanism —
  the H5 re-calls `start-location` before expiry and fixes keep flowing
  without a gap.
- While the permission dialog is up, the original `start-location` is
  suspended; its response goes out only after the dialog resolves
  (`:96-115`).
- A further `start-location` arriving during that dialog is answered
  immediately with `-1 "location permission request in progress"` (`:82-84`).
- Permission denied answers `1001` and stops any session (`:113-114`). The
  bridge has no retry path; only the user granting the permission in system
  settings changes the outcome.
- Backgrounding pauses the GPS subscription (`onHostPause`, `:66-71`) but the
  session timer keeps ticking (`TimerSource` posts on the main looper), so a
  session left in the background expires like any other. On resume the GPS
  restarts if the session is still alive (`onHostResume`, `:59-64`).
- Activity destruction calls `release` and drops the bridge — session off,
  GPS stopped (`:73-77`; `VoisWebActivity.java:401-403`).

## Error codes

| errcode | meaning           | raised when                                                                                              | H5 action                                     |
| ------- | ----------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 0       | ok                | success paths                                                                                            | proceed                                       |
| -1      | rejected          | bad params (`:88-90`); start while a dialog is pending (`:82-84`); get without a live session (`:131-133`) | fix params, retry start, or reopen a session  |
| 1001    | permission denied | user denied the location dialog (`:114`)                                                                  | stop calling; send the user to system settings |

Framework-level failures (missing type field, unsupported type, handler
exception) reuse the same envelope with `-1`; they are documented in the 5.0.4
protocol doc, not here.

## Envelope

Responses are JSON strings built by `BridgeResponseBuilder`
(`bridge/BridgeResponseBuilder.java`): `buildSuccess` for errcode 0,
`buildError` otherwise. Same shape as every other type:

```json
{ "type": "get-location", "errcode": 0, "errmsg": "", "data": {} }
```

`errmsg` is `""` on success and carries the reason on failure. `data` is always
an object; `location` inside it may be `null`.

## What the fix is — and is not

The bridge exposes the **phone's own GPS**. `WebLocationBridge` listens on the
app-wide `LocationImpl` singleton
(`com/voistech/chat/location/LocationImpl.java`), which wraps
`com.voistech.location.LocationManager` — the AMap location stack. It says
nothing about the managed sub-device's position: the device reports its own
location over the private TCP channel, and H5 reads device position from the
HTTP APIs (`/v2/subuser/track-*`, `geofence-*`). Do not use this bridge as a
device tracker.

## H5 side

`apps/website/src/utils/bridge/location-bridge.ts` declares the protocol types
and error constants, and `apps/website/src/composables/useRealtimeLocation.ts`
runs the loop. The product contract keeps native's dialog chain in charge:
every mount and every refocus sends `start-location` unconditionally, and the
`get-permissions` probe only labels the wait in the UI. `0` opens the poll
(`get` each interval, renew before expiry), a `get` `-1` reopens the session,
a `start` `-1` retries with bounded backoff, and `1001` stops the run: no
further start or get until the page is re-entered or the user taps retry.
