# Device location

A device's location page pins the device's last track point of the day, its fence, and the phone's own live position; the track page draws one day's recorded route; the reporting page sets how often the device uploads its position.

## Sub-features

- `location-device` shows 设备位置 from the device's last track point of the day, with its fence on the AMap canvas.
- `location-mine` shows the phone's own position from the `start-location`/`get-location` bridge, labelled 我的实时位置 (else 我的位置未开始, 正在获取我的位置…, the denied guidance, or the tap-to-retry error).
- `location-fence-warning` warns that the fence cannot take effect while track reporting is off.
- `track-map` draws one day's recorded route, chosen with 选择日期.
- `track-frequency` offers 关闭 / 低频上报 / 中频上报 / 高频上报 and applies the choice.

## How to get to it (user POV)

- Device detail → 位置和围栏 (in-app link) → `#/devices/<id>/location`.
- Device detail → 轨迹记录 (in-app link) → `#/devices/<id>/track`.
- Device detail → 轨迹上报设置 (in-app link) → `#/devices/<id>/track-setting`; the fence warning on the location page also links here.
- Open any of these by URL directly; native may deep-link this way.

## Driving it with ego-browser

Preconditions:

- The device-detail preconditions, plus a real device id from the manager list (for example `1848581`).
- `VITE_AMAP_KEY` and `VITE_AMAP_SECURITY_CODE` in `~/.vois/.env`; without them the AMap canvas never initialises.
- The map data comes from the real API: `geofence-get`, `track-get-mode`, and `track-get`. There is no mock server.
- The phone's own live position needs the native `start-location`/`get-location` bridge, implemented in Android App 5.0.8+. In the DevServer a debug source stands in (below), so the flow is drivable without the app.

- **Location.** Run `await page.goto("http://localhost:3021/#/devices/1848581/location")`. The header reads 位置和围栏 and the capture gains `POST /v2/subuser/geofence-get`, `POST /v2/subuser/track-get-mode`, and `POST /v2/subuser/track-get` (body `date` = today), all `errcode: 0`. `main` contains the AMap canvas (the `© … AutoNavi` attribution and the zoom controls come from AMap, not the app). 设备位置 is the day's last `track-get` point, with its time beside it.
- **Agree with the capture.** The device marker's coordinates equal the last entry of `responseBody.data.tracks` (or are absent when the day has no points); the fence overlay matches `geofence-get`'s `geofence`.
- **Fence warning.** When `track-get-mode` answers mode 0, the page shows 当前轨迹上报已关闭电子围栏无法生效，可点击修改轨迹上报频率, a link to `./track-setting`.
- **Phone realtime — DevServer.** The loop needs a bridge. With no App and no injected native bridge (a plain `vp dev`) the page substitutes a debug source: a dot walks a circle around (114.0668, 22.6305) at a 3 s interval inside a 30 s session, and the label reads 我的实时位置. With the instrumented debug pipeline linked, the page instead makes its own `start-location`/`get-location` calls, which appear as `bridge` events (`errcode: 0`); the debug bridge has no GPS, so the fix is empty and the dot stays put — that is the pipeline, not a regression.
- **Phone realtime — real device (App 5.0.8+).** The native `start-location`/`get-location` bridge lands in Android App 5.0.8+. Every mount and refocus sends `start-location` unconditionally, so with the permission off native's own dialog chain appears (system dialog, or the 需要权限/去设置 dialog when permanently denied). `errcode 0` opens the poll and the page reads 我的实时位置 with the fix time beside it. While native's dialog holds the answer and the `get-permissions` probe (App build 10191150+) says off, the line reads 定位权限未开启，请在弹窗中允许，或前往系统设置开启 instead of 正在获取我的位置…. `1001` is an explicit denial and stops the run: the line reads 定位权限未开启，请在系统设置中开启定位权限后，点此重试。, tapping retries, and a page re-enter starts a fresh round. This is the only proof of a live phone dot; mark it skipped when it could only be driven in a browser.
- **Track.** Run `await page.goto("http://localhost:3021/#/devices/1848581/track")`. The header reads 轨迹记录 and the capture gains `POST /v2/subuser/track-get` (body `date` = today). A 选择日期 picker changes the date and re-runs `track-get` for it; a day with no points shows 当日无轨迹记录 and no route.
- **Frequency.** Run `await page.goto("http://localhost:3021/#/devices/1848581/track-setting")`. The header reads 轨迹上报设置, the capture gains `POST /v2/subuser/track-get-mode`, and the four options 关闭 / 低频上报 / 中频上报 / 高频上报 render in a radiogroup with the current one checked. Choosing another calls `POST /v2/subuser/track-set-mode` with `{ user_id, mode }` — a real write; see Gotchas.
- **Proof.** Write `apps/website/.tmp/verify/device-location/location.png`, `track.png`, and `agreement.json` with `{ endpoints, errcode, hasCanvas, fence, mode }`. The screenshot is the proof: the map is a canvas, so an ARIA snapshot cannot show the dots or the route.

## Gotchas

- The AMap attribution, the zoom label, and the `+`/`-` controls are third-party chrome. Assert the canvas plus the app's own header and warning text; do not assert tile contents (they depend on network and time).
- 设备位置 is the day's last track point (`getRecentTrackPoint`), not a live device fix. Only the phone's own dot is live, and that needs the native bridge in App 5.0.8+; mark a real-device bridge run as skipped, not passed, when it could only be driven in the DevServer.
- Choosing a frequency is a real write to `track-set-mode`; it changes the device's upload behaviour and battery use. Verify by safe observation — the request body and the checked option — and restore the original value afterwards. Report `track-set-mode` as write-observed unless the run is explicitly about it.
- `track-get` takes a date the device's timezone reports, and the location page uses today's points. A point's `type` is its coordinate system (0 gcj02, 1 wgs84); do not mix them.
- Map pages need a real network for tiles; a rendered-but-blank canvas is usually a tile or blocked-network problem, not an app regression.
- Judge by `errcode`, not HTTP status. No fence and no points are valid `errcode: 0` cases (`geofence: null`, empty `tracks`).
