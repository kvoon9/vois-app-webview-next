# Device location

A device's location page pins the device's last track point of the day, its fence, and the phone's own live position behind native's chrome — a round fence button top-right and a compact status pill at the bottom; the track page draws one day's recorded route; the reporting page sets how often the device uploads its position.

## Sub-features

- `location-device` pins the device's last track point of the day as the map marker — native's MapUserAvatar build: a blue bearing droplet behind a white ring and a 36px round avatar (the nick's initial when there is no avatar) — plus the fence on the canvas, drawn no matter its enable state (a deliberate H5 deviation: native hides disabled fences). There is no 设备位置 card and no device time label on screen.
- `location-fence-entry` is one white rounded square at the top-right with a crosshair icon over the 围栏 label: 添加围栏 with no fence, 修改围栏 with one. The 共享 button native draws has no bridge call behind it and stays out. The map itself carries native-style chrome: compass top-left, a locate-me button bottom-left (centres the map on 我的位置), zoom +/− bottom-right, a whitesmoke map style, and the fence drawn as native's pure-green thin stroke over an 8% black fill with no centre marker.
- `location-fence` adds, edits, and deletes the device's single electronic fence: 添加围栏 asks for confirmation first, an existing fence goes straight to the editor, the top strip steps the radius (− / 200 米 / slider / 1000 米 / +), the sheet carries 围栏中心 / 围栏半径 / 围栏名称 and a full-width 保存, and 删除围栏 appears only for an existing fence.
- `location-mine` shows the phone's own position from the `start-location`/`get-location` bridge as a compact bottom pill labelled 我的实时位置 (else 我的位置未开始, 正在获取我的位置…, the denied guidance, or the tap-to-retry error).
- `location-fence-warning` warns that the fence cannot take effect while track reporting is off or low.
- `track-map` draws one day's recorded route; the 选择日期 calendar opens on entry, the `M/d` badge appears only after a date is confirmed, and an empty day reports as a bottom toast 暂无轨迹记录 that times out.
- `track-frequency` offers 关闭 / 低频上报 / 中频上报 / 高频上报 in one card and applies the choice.

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

- **Location.** Run `await page.goto("http://localhost:3021/#/devices/1848581/location")`. The header reads 位置和围栏 and the capture gains `POST /v2/subuser/geofence-get`, `POST /v2/subuser/track-get-mode`, and `POST /v2/subuser/track-get` (body `date` = today), all `errcode: 0`. `main` contains the AMap canvas (the `© … AutoNavi` attribution comes from AMap, not the app), one round button at the top-right whose accessible name is 添加围栏 or 修改围栏, and the status pill at the bottom.
- **Agree with the capture.** The device marker's coordinates equal the last entry of `responseBody.data.tracks` (or are absent when the day has no points); the fence overlay matches `geofence-get`'s `geofence`; the button's name follows it (添加围栏 when `geofence` is null, 修改围栏 otherwise).
- **Fence warning.** When `track-get-mode` answers mode 0 the bottom stack shows 当前轨迹上报已关闭电子围栏无法生效，可点击修改轨迹上报频率, and for the low mode 当前轨迹上报频率低电子围栏无法生效，可点击修改轨迹上报频率; both link to `./track-setting`.
- **Phone realtime — DevServer.** The loop needs a bridge. With no App and no injected native bridge (a plain `vp dev`) the page substitutes a debug source: a dot walks a circle around (114.0668, 22.6305) at a 3 s interval inside a 30 s session, and the bottom pill reads 我的实时位置. With the instrumented debug pipeline linked, the page instead makes its own `start-location`/`get-location` calls, which appear as `bridge` events (`errcode: 0`); the debug bridge has no GPS, so the fix is empty and the dot stays put — that is the pipeline, not a regression.
- **Phone realtime — real device (App 5.0.8+).** The native `start-location`/`get-location` bridge lands in Android App 5.0.8+. Every mount and refocus sends `start-location` unconditionally, so with the permission off native's own dialog chain appears (system dialog, or the 需要权限/去设置 dialog when permanently denied). `errcode 0` opens the poll and the pill reads 我的实时位置 with the fix time beside it. While native's dialog holds the answer and the `get-permissions` probe (App build 10191150+) says off, the pill reads 定位权限未开启，请在弹窗中允许，或前往系统设置开启 instead of 正在获取我的位置…. `1001` is an explicit denial and stops the run: the pill reads 定位权限未开启，请在系统设置中开启定位权限后，点此重试。, tapping it retries, and a page re-enter starts a fresh round. This is the only proof of a live phone dot; mark it skipped when it could only be driven in a browser.
- **Track.** Run `await page.goto("http://localhost:3021/#/devices/1848581/track")`. The header reads 轨迹记录 and the capture gains `POST /v2/subuser/track-get` (body `date` = today). The calendar is already open on entry, today preselected, with 取消 and 确定; confirming closes it and only then does the top-right `M/d` badge appear. A day with no points answers with a bottom toast 暂无轨迹记录 that clears itself after about 2.6 s. Reopening with the header calendar button (`aria-label="选择日期"`) changes the date and re-runs `track-get` for it; days after today are disabled.
- **Fence — no fence yet.** Tap the round button whose name is 添加围栏. A dialog titled 添加围栏 opens with the body 将为该设备创建一个新的电子围栏。进入创建页后，长按地图设置围栏中心，调整半径后保存即可生效。 and the buttons 取消 / 确认; 确认 opens the editor.
- **Fence — edit (write).** Tap the round button whose name is 修改围栏 and the editor opens directly, with no confirmation. The header reads 电子围栏 and the entry toast reads 请长按地图设置围栏中心点. The top strip is the radius control: − (`aria-label="-50"`), 200 米, the slider (`aria-label="围栏半径"`), 1000 米, + (`aria-label="+50"`). The sheet shows 围栏中心 (empty until a centre is picked, then the reverse-geocoded address), 围栏半径 (the stored radius, 300 米 on a new fence), and 围栏名称. Picking a point on the map moves the marker and preview circle; 保存 runs `geofence-set` with `{ user_id, name, latitude, longitude, radius }`, and 删除围栏 (existing fence only) asks 删除后，该设备将不再受该电子围栏监控，确定继续吗？ then runs `geofence-delete` with `{ user_id, geofence_id }`. Restore the original state afterwards.
- **Frequency.** Run `await page.goto("http://localhost:3021/#/devices/1848581/track-setting")`. The header reads 轨迹上报设置, the capture gains `POST /v2/subuser/track-get-mode`, and the four options 关闭 / 低频上报 / 中频上报 / 高频上报 render in one card as a radiogroup with the current one checked. Choosing another calls `POST /v2/subuser/track-set-mode` with `{ user_id, mode }` — a real write; see Gotchas.
- **Proof.** Write `apps/website/.tmp/verify/device-location/location.png`, `track.png`, and `agreement.json` with `{ endpoints, errcode, hasCanvas, fence, mode }`. The screenshot is the proof: the map is a canvas, so an ARIA snapshot cannot show the dots or the route.

## Gotchas

- The 共享 button native draws on this map has no bridge call behind it and is intentionally absent; its absence is not a missing feature. The round fence button is the only page-owned map control.
- An existing fence skips the 添加围栏 confirmation and goes straight to the editor; only a device without a fence shows the dialog. Do not report the missing dialog as broken.
- The editor's hint says 请长按地图设置围栏中心点, but the canvas picks on a single click/tap. The copy is native's wording, not a description of the gesture.
- 围栏中心 is empty until a centre is picked or a stored fence loads, and it holds the AMap reverse-geocoded address (falling back to `lng, lat` when the lookup fails). An empty row on a fresh fence is correct.
- The radius buttons step 50 m and clamp to 200–1000 m; the save action is 保存 (not 确定), and it refuses a missing centre or an empty name with a toast before any call.
- Track's empty-day message is a transient bottom toast (about 2.6 s), not a persistent pill on the map — assert it immediately after confirming the date. Confirming the same day re-reports it without a new `track-get`.
- The calendar opens by itself on entry, and the `M/d` badge is absent until a date is confirmed. Both are the current design, not a stuck overlay or a missing tag.
- The AMap attribution, the zoom control (bottom-right, `ToolBar` `position: 'RB'`), and the `+`/`-` controls are third-party chrome. Assert the canvas plus the app's own header and warning text; do not assert tile contents (they depend on network and time).
- 设备位置 is the day's last track point (`getRecentTrackPoint`), not a live device fix, and it is the marker's title attribute rather than on-screen text. Only the phone's own dot is live, and that needs the native bridge in App 5.0.8+; mark a real-device bridge run as skipped, not passed, when it could only be driven in the DevServer.
- The 电子围栏 editor is a real write that changes what the device monitors. Verify it only on a fence you may change, and put the device back to its previous fence (or none) before you finish.
- Choosing a frequency is a real write to `track-set-mode`; it changes the device's upload behaviour and battery use. Verify by safe observation — the request body and the checked option — and restore the original value afterwards. Report `track-set-mode` as write-observed unless the run is explicitly about it.
- `track-get` takes a date the device's timezone reports, and the location page uses today's points. A point's `type` is its coordinate system (0 gcj02, 1 wgs84); do not mix them.
- Map pages need a real network for tiles; a rendered-but-blank canvas is usually a tile or blocked-network problem, not an app regression.
- Judge by `errcode`, not HTTP status. No fence and no points are valid `errcode: 0` cases (`geofence: null`, empty `tracks`).
