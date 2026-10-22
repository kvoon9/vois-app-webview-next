// @env browser

export type {
  BridgeLocation,
  BridgePermissionName,
  GetLocationRes,
  GetPermissionsRes,
  StartLocationRes,
} from '@vois/webview-bridge/vois'

/**
 * Realtime location bridge, implemented natively in Android 5.0.8+
 * (`WebLocationBridge`). The H5 side owns the loop: `start-location` opens a
 * bounded session (the app keeps the GPS subscription alive for `time` ms),
 * then `get-location` is polled and answers the last known fix each time.
 * There is no stop message; the session simply expires, so keep `time` short
 * and renew it while the page still wants fixes.
 *
 * `get-permissions` (`WebPermissionBridge`, App build 10191150+) is the
 * permission ground truth the loop checks before it ever calls
 * `start-location`: a pure query that never raises a dialog.
 *
 * The wire types themselves are the package's built-in map
 * (`@vois/webview-bridge/vois`); only the numbers and names the polling loop
 * reasons about stay here.
 */

/** Native clamps: interval ≥ 5s, time ∈ [15s, 60s] (`WebLocationBridge`). */
export const LOCATION_MIN_INTERVAL_MS = 5_000
export const LOCATION_MIN_TIME_MS = 15_000
export const LOCATION_MAX_TIME_MS = 60_000

/** Session requested while a permission dialog is still pending, or bad params. */
export const LOCATION_ERR_INVALID = -1
/** The user denied location permission; no further start/get call may be made. */
export const LOCATION_ERR_PERMISSION_DENIED = 1001

/** The one group the realtime-location flow cares about. */
export const LOCATION_PERMISSION = 'location'
