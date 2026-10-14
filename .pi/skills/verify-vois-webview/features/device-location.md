# Device location

A device's location page pins it on a map with its electronic fence, the track page draws the recorded route, and the reporting-frequency page sets how often the device uploads its position.

## Sub-features

- `location-map` pins the device and its fence on the AMap canvas.
- `location-fence-warning` warns that the fence cannot take effect while track reporting is off.
- `track-map` draws the recorded route.
- `track-frequency` offers 关闭 / 低频上报 / 中频上报 / 高频上报 and applies the choice.

## How to get to it (user POV)

- URL-only routes (`location`, `track`, `track-setting`): nothing in this repo links them and the documented native entry points do not list them. They render, but no user path to them is proven.

## Driving it with ego-browser

Preconditions:

- **Mode M** for the map data: in mode R all three render 无法连接服务器 because `device/location` and `device/track` answer HTTP 404. `track-setting` needs no call but reads the state another page fetched.
- `VITE_AMAP_KEY` and `VITE_AMAP_SECURITY_CODE` in `~/.vois/.env`; without them the AMap canvas never initialises.
- A mock device id (`101`).

- **Location.** Run `await page.goto("http://localhost:3021/#/devices/101/location")`. The header reads 位置和围栏, the capture gains `POST /v2/device/location` with `errcode: 0`, and `main` contains the AMap canvas (the zoom control `1 公里`, the `+`/`-` controls, and the `© … AutoNavi` attribution come from AMap, not the app).
- **Fence warning.** With track reporting off, the page shows 当前轨迹上报已关闭电子围栏无法生效，可点击修改轨迹上报频率.
- **Track.** Run `await page.goto("http://localhost:3021/#/devices/101/track")`: the header reads 轨迹记录 and the capture gains `POST /v2/device/track` and `POST /v2/device/location`, both `errcode: 0`, and the map renders.
- **Frequency.** Drive `#/devices/101/track` first, then `#/devices/101/track-setting`. The header reads 轨迹上报设置 and the four options 关闭 / 低频上报 / 中频上报 / 高频上报 render with the current one selected. Choosing another option writes (`device/update-track-setting`) — safe in mode M, a real write against a real device in mode R.
- **Proof.** Write `apps/website/.tmp/verify/device-location/mode-M/location.png`, `track.png`, and `map.json` with `{ endpoint, errcode, hasCanvas, zoomLabel }`. The screenshot is the proof here: the map is a canvas, so the ARIA snapshot cannot show the pin.

## Gotchas

- The AMap attribution, zoom label, and `+`/`-` controls are third-party chrome. Assert the canvas exists and the app's own header/warning text; do not assert tile contents (they depend on network and time).
- `track-setting` makes no call of its own: entered cold it renders the four options without a current selection. Drive the track page first when the recipe asserts which option is active.
- Map pages need a real network for tiles; a rendered-but-blank canvas is usually a tile/blocked-network problem, not an app regression.
- Turn on track reporting before testing the fence; with reporting off the page says the fence cannot take effect.
