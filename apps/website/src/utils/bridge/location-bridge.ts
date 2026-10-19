// @env browser

import type { BridgeFn } from '@vois/webview-bridge'

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
 */

/** Native clamps: interval ≥ 5s, time ∈ [15s, 60s] (`WebLocationBridge`). */
export const LOCATION_MIN_INTERVAL_MS = 5_000
export const LOCATION_MIN_TIME_MS = 15_000
export const LOCATION_MAX_TIME_MS = 60_000

/** Session requested while a permission dialog is still pending, or bad params. */
export const LOCATION_ERR_INVALID = -1
/** The user denied location permission; no further start/get call may be made. */
export const LOCATION_ERR_PERMISSION_DENIED = 1001

/**
 * Permission groups `get-permissions` understands. Native maps each name onto
 * its `PermissionUtil.PermissionGroup`; an unknown name is silently skipped,
 * so the answer only carries names this build knows.
 */
export type BridgePermissionName =
  | 'location'
  | 'background-location'
  | 'audio-recording'
  | 'camera'
  | 'nearby-devices'
  | 'notification'

/** The one group the realtime-location flow cares about. */
export const LOCATION_PERMISSION = 'location'

/** `start-location` response body. */
export interface StartLocationData {
  /** Effective interval after native clamping, ms. */
  interval?: number
  /** Effective session length after native clamping, ms. */
  time?: number
}

export interface StartLocationResponse {
  errcode: number
  errmsg: string
  data?: StartLocationData
}

/** One GPS fix as the app reports it. */
export interface BridgeLocation {
  latitude: number
  longitude: number
  altitude: number | null
  /** Accuracy radius in meters. */
  accuracy: number | null
  /** Meters per second. */
  speed: number | null
  /** Heading in degrees. */
  bearing: number | null
  /** Fix time, ms since epoch. */
  time: number
  name: string | null
  address: string | null
}

/** `get-location` response body. */
export interface GetLocationData {
  /** `'gcj02'` on the CN flavor, `'wgs84'` otherwise. */
  coordType?: string
  /** The last known fix, possibly stale; `null` until the first fix arrives. */
  location?: BridgeLocation | null
}

export interface GetLocationResponse {
  errcode: number
  errmsg: string
  data?: GetLocationData
}

/**
 * `get-permissions` response body: one boolean per requested group, keyed by
 * the group name. Always `errcode: 0` on builds that have the handler.
 */
export interface GetPermissionsResponse {
  errcode: number
  errmsg: string
  data?: Partial<Record<BridgePermissionName, boolean>>
}

declare module '@vois/webview-bridge' {
  interface BridgeProtocolMap {
    'start-location': BridgeFn<{ interval: number; time: number }, StartLocationResponse>
    'get-location': BridgeFn<Record<string, never>, GetLocationResponse>
    /** `params` omitted or empty answers every group native knows. */
    'get-permissions': BridgeFn<{ params?: BridgePermissionName[] }, GetPermissionsResponse>
  }
}
