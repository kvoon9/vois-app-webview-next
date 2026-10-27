// @env browser

import { onScopeDispose, shallowRef, ref, type Ref, type ShallowRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import { isSupportBridge } from '@vois/webview-bridge'
import { whenWebviewBridge } from '~/composables/useWebviewBridge'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import {
  LOCATION_ERR_INVALID,
  LOCATION_ERR_PERMISSION_DENIED,
  LOCATION_PERMISSION,
  LOCATION_MAX_TIME_MS,
  LOCATION_MIN_INTERVAL_MS,
  type BridgeLocation,
  type GetLocationRes,
  type GetPermissionsRes,
  type StartLocationRes,
} from '~/utils/bridge/location-bridge'
import { wgs84ToGcj02 } from '~/utils/coords'

/** Lifecycle of the polling loop. */
export type RealtimeLocationStatus =
  | 'idle'
  | 'starting'
  | 'tracking'
  /**
   * Native answered 1001: the user denied. The contract forbids further
   * start/get in this run; a page re-enter or an explicit tap retry opens
   * the next round.
   */
  | 'denied'
  /** No bridge, no debug simulation, and no browser geolocation. */
  | 'unsupported'
  | 'error'

/** Result of the UI-only permission probe that rides along every start round. */
export type RealtimePermission = 'unknown' | 'granted' | 'denied'

/** Transport the loop talks to: the real bridge, a debug simulation, or a test double. */
export interface RealtimeLocationSource {
  /**
   * Permission probe for UI labeling only. `null` when the bridge cannot
   * answer (older build without `get-permissions`, or the query failed);
   * never used to decide whether a call may go out.
   */
  permissions(): Promise<{ granted: boolean } | null>
  start(intervalMs: number, timeMs: number): Promise<StartLocationRes>
  get(): Promise<GetLocationRes>
  /**
   * Optional: release transport resources when the loop stops calling. The
   * bridge has no stop message (its session self-expires); the browser source
   * clears its watch here so no GPS subscription outlives the page's interest.
   */
  stop?(): void
}

/** How long a `get-permissions` probe may take before it counts as unknown. */
const PERMISSION_TIMEOUT_MS = 5_000
/** How long a `get-location` call may take before the poll counts as missed. */
const GET_TIMEOUT_MS = 5_000
/** A `start-location` may wait on the permission dialog, so it gets a long leash. */
const START_TIMEOUT_MS = 90_000
/** Retries for a plain `-1` start answer (bad params, unexpected state). */
const MAX_START_RETRIES = 3
/**
 * Retries while native reports the previous start-location still unanswered
 * (its permission dialog is up). The dialog can legally sit unanswered for a
 * long time, so this leash is loose; when it runs out the loop stops instead
 * of hammering a stuck bridge forever.
 */
const MAX_PERMISSION_WAIT_RETRIES = 12

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

/** The real transport: uniBridgeCall over the injected native bridge. */
function bridgeSource(): RealtimeLocationSource {
  return {
    async permissions() {
      try {
        const bridge = await whenWebviewBridge()
        if (!bridge) return null
        // SAFETY: the protocol map declares this response shape for 'get-permissions'.
        const response = (await bridge.request('get-permissions', {
          params: [LOCATION_PERMISSION],
        })) as GetPermissionsRes
        if (response.errcode !== 0) return null
        // A build without the handler (and the DevServer debug stand-in)
        // answers an empty success; a missing key means unknown, not denied.
        const granted = response.data?.[LOCATION_PERMISSION]
        if (granted === undefined) return null
        return { granted }
      } catch {
        // Old builds have no handler and frameworks answer oddly; treat as unknown.
        return null
      }
    },
    async start(intervalMs, timeMs) {
      const bridge = await whenWebviewBridge()
      if (!bridge) throw new Error('bridge unavailable')
      const response = await bridge.request('start-location', {
        interval: intervalMs,
        time: timeMs,
      })
      // SAFETY: the protocol map declares this response shape for 'start-location'.
      return response as StartLocationRes
    },
    async get() {
      const bridge = await whenWebviewBridge()
      if (!bridge) throw new Error('bridge unavailable')
      const response = await bridge.request('get-location', {})
      // SAFETY: the protocol map declares this response shape for 'get-location'.
      return response as GetLocationRes
    },
  }
}

/**
 * DevServer-only stand-in: walks a circle around a center so the whole page
 * flow is drivable in a plain browser via ego-browser.
 */
export function debugLocationSource(center: { lng: number; lat: number }): RealtimeLocationSource {
  const startedAt = { current: 0 }
  return {
    async permissions() {
      return { granted: true }
    },
    async start() {
      startedAt.current = Date.now()
      return { errcode: 0, errmsg: 'debug', data: { interval: 3_000, time: 30_000 } }
    },
    async get() {
      if (!startedAt.current)
        return { errcode: LOCATION_ERR_INVALID, errmsg: 'location not running' }
      if (Date.now() - startedAt.current > 30_000) {
        return { errcode: LOCATION_ERR_INVALID, errmsg: 'location not running' }
      }
      const angle = ((Date.now() - startedAt.current) / 10_000) * 2 * Math.PI
      const radius = 0.002
      return {
        errcode: 0,
        errmsg: 'debug',
        data: {
          coordType: 'gcj02',
          location: {
            latitude: center.lat + radius * Math.sin(angle),
            longitude: center.lng + radius * Math.cos(angle),
            altitude: null,
            accuracy: 20,
            speed: 1.5,
            bearing: null,
            time: Date.now(),
            name: null,
            address: null,
          },
        },
      }
    },
  }
}

export interface UseRealtimeLocationOptions {
  /** Poll interval request; native clamps it to at least 5s. */
  intervalMs?: number
  /** Session length request; native clamps it to [15s, 60s]. */
  timeMs?: number
  /** Transport override for tests. */
  source?: RealtimeLocationSource
  /** Start polling right away instead of waiting for `start()`. */
  immediate?: boolean
}

/** Browser GeolocationPositionError.PERMISSION_DENIED. */
const GEO_ERR_PERMISSION_DENIED = 1

/**
 * Browser-geolocation transport for plain H5: `start` registers a
 * `watchPosition` and holds its answer until the first event (the browser
 * permission prompt plays the role native's dialog plays for the bridge), and
 * `get` serves the last cached fix as a bridge-shaped answer, converted to
 * GCJ-02 here, the boundary where WGS-84 is born. Returns null when the
 * browser exposes no geolocation (insecure origin, old engine), so the page
 * falls through to `unsupported`.
 */
export function browserLocationSource(): RealtimeLocationSource | null {
  if (!('geolocation' in navigator)) return null

  let watchId: number | null = null
  let last: BridgeLocation | null = null
  let denied = false
  let settleStart: ((res: StartLocationRes) => void) | null = null

  function settle(res: StartLocationRes): void {
    settleStart?.(res)
    settleStart = null
  }

  /** One browser fix in the loop's wire shape; engines report NaN headings too. */
  function toFix(position: GeolocationPosition): BridgeLocation {
    const converted = wgs84ToGcj02(position.coords.longitude, position.coords.latitude)
    const heading = position.coords.heading
    return {
      latitude: converted.lat,
      longitude: converted.lng,
      altitude: position.coords.altitude ?? null,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed ?? null,
      bearing: heading == null || Number.isNaN(heading) ? null : heading,
      time: position.timestamp,
      name: null,
      address: null,
    }
  }

  return {
    async permissions() {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' })
        if (status.state === 'granted') return { granted: true }
        if (status.state === 'denied') return { granted: false }
        // 'prompt': not asked yet, so unknown rather than denied.
        return null
      } catch {
        // Safari and older engines lack the query; unknown, not denied.
        return null
      }
    },
    async start(intervalMs, timeMs) {
      const echo: StartLocationRes = {
        errcode: 0,
        errmsg: 'browser',
        data: { interval: intervalMs, time: timeMs },
      }
      // The watch is the session, so a renewal is a no-op that echoes bounds.
      if (watchId != null) return echo
      last = null
      denied = false
      return new Promise<StartLocationRes>((resolve) => {
        settleStart = resolve
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            last = toFix(position)
            settle(echo)
          },
          (error) => {
            if (error.code !== GEO_ERR_PERMISSION_DENIED) {
              // Unavailable or timed out: the session still opens and later
              // fixes may still arrive.
              settle(echo)
              return
            }
            denied = true
            if (watchId != null) {
              navigator.geolocation.clearWatch(watchId)
              watchId = null
            }
            settle({ errcode: LOCATION_ERR_PERMISSION_DENIED, errmsg: error.message })
          },
          { enableHighAccuracy: true, maximumAge: intervalMs },
        )
      })
    },
    async get() {
      if (denied) return { errcode: LOCATION_ERR_PERMISSION_DENIED, errmsg: 'permission denied' }
      if (watchId == null) return { errcode: LOCATION_ERR_INVALID, errmsg: 'location not running' }
      return { errcode: 0, errmsg: 'browser', data: { coordType: 'gcj02', location: last } }
    },
    stop() {
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
      // Unblocks a held start; the loop's generation guard drops the answer.
      settle({ errcode: LOCATION_ERR_INVALID, errmsg: 'stopped' })
      // `last` is kept: the loop serves the stale fix after a stop, like the bridge.
    },
  }
}

export interface UseRealtimeLocation {
  status: Ref<RealtimeLocationStatus>
  /** Latest accepted fix; kept (stale) after the loop stops. */
  point: ShallowRef<BridgeLocation | null>
  /** Coordinate system of `point`; AMap needs gcj02. */
  coordType: Ref<'gcj02' | 'wgs84'>
  /** UI-only permission probe result; never gates a call. */
  permission: Ref<RealtimePermission>
  start: () => void
  stop: () => void
}

/**
 * Polls the device's realtime location over the bridge. Every mount and every
 * refocus runs one fresh start round: `start-location` goes out
 * unconditionally and native owns the permission dialog chain, so a
 * no-permission user gets the native ask instead of an H5 gate. `0` opens the
 * session and `get-location` is polled at the interval, renewed just before
 * the session expires. A `get` `-1` means the session is gone and reopens it;
 * a `start` `-1` means bad params or a still-unanswered previous call and
 * retries with backoff, bounded. `1001` is an explicit denial and stops the
 * run: no further start or get until the page is re-entered or the user taps
 * retry. A start that never answers (its dialog abandoned via the settings
 * jump) hits the 90s leash and lands in the retryable error state. The
 * `get-permissions` probe rides along every round purely to label the UI.
 */
export function useRealtimeLocation(options: UseRealtimeLocationOptions = {}): UseRealtimeLocation {
  const intervalMs = Math.max(
    LOCATION_MIN_INTERVAL_MS,
    options.intervalMs ?? LOCATION_MIN_INTERVAL_MS,
  )
  const timeMs = Math.min(LOCATION_MAX_TIME_MS, options.timeMs ?? 30_000)
  const source = options.source ?? (isSupportBridge() ? bridgeSource() : null)

  const status = ref<RealtimeLocationStatus>('idle')
  const point = shallowRef<BridgeLocation | null>(null)
  const coordType = ref<'gcj02' | 'wgs84'>('gcj02')
  const permission = ref<RealtimePermission>('unknown')

  let running = false
  let session = { interval: intervalMs, time: timeMs }
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let renewTimer: ReturnType<typeof setTimeout> | undefined
  let startRetries = 0
  let permissionWaitRetries = 0
  let generation = 0

  function clearTimers(): void {
    clearTimeout(pollTimer)
    clearTimeout(renewTimer)
    pollTimer = undefined
    renewTimer = undefined
  }

  /** Halting means the loop stops calling the source too; release its resources. */
  function release(): void {
    clearTimers()
    source?.stop?.()
  }

  function scheduleRenewal(): void {
    // Re-issue start-location one poll before expiry; native restarts the
    // session timer in place, so fixes keep flowing without a gap.
    const delay = Math.max(session.interval, session.time - session.interval - 1_000)
    renewTimer = setTimeout(renew, delay)
  }

  async function renew(): Promise<void> {
    if (!running || status.value !== 'tracking') return
    const response = await withTimeout(
      source!.start(session.interval, session.time),
      START_TIMEOUT_MS,
      null,
    )
    if (!running) return
    if (response && response.errcode === 0) scheduleRenewal()
    // On failure let the next poll hit `-1` and fall into the restart path.
  }

  async function poll(): Promise<void> {
    if (!running || status.value !== 'tracking') return
    const response = await withTimeout(source!.get(), GET_TIMEOUT_MS, null)
    if (!running) return
    if (response === null) {
      // A hung get counts as a missed poll, not an error.
    } else if (response.errcode === LOCATION_ERR_PERMISSION_DENIED) {
      // The contract stops start and get after an explicit denial.
      status.value = 'denied'
      running = false
      release()
      return
    } else if (response.errcode === 0) {
      const fix = response.data?.location ?? null
      coordType.value = response.data?.coordType === 'wgs84' ? 'wgs84' : 'gcj02'
      if (fix && (!point.value || fix.time >= point.value.time)) point.value = fix
    } else {
      // Session expired between renewals; open a new one.
      void begin()
      return
    }
    pollTimer = setTimeout(poll, session.interval)
  }

  /** UI-only probe; its answer labels the wait, it never gates a call. */
  async function refreshPermission(current: number): Promise<void> {
    if (!source) return
    const result = await withTimeout(source.permissions(), PERMISSION_TIMEOUT_MS, null)
    if (current !== generation) return
    permission.value = result === null ? 'unknown' : result.granted ? 'granted' : 'denied'
  }

  async function begin(): Promise<void> {
    if (!running || !source) return
    status.value = 'starting'
    const current = ++generation
    void refreshPermission(current)
    const response = await withTimeout(source.start(intervalMs, timeMs), START_TIMEOUT_MS, null)
    if (!running || current !== generation) return
    if (response === null) {
      // Native never answered (e.g. its dialog was abandoned via the settings
      // jump). Give up this round; a retry tap or the next refocus starts anew.
      status.value = 'error'
      running = false
      release()
      return
    }
    if (response.errcode === LOCATION_ERR_PERMISSION_DENIED) {
      // Explicit denial: the contract stops start and get for this run.
      status.value = 'denied'
      running = false
      release()
      return
    }
    if (response.errcode !== 0) {
      // `-1`: bad params, or the previous call is still unanswered. Back off
      // and retry, bounded; the pending-dialog flavor gets a looser leash.
      const dialogPending = response.errmsg.includes('permission request in progress')
      if (dialogPending && permissionWaitRetries < MAX_PERMISSION_WAIT_RETRIES) {
        permissionWaitRetries += 1
        pollTimer = setTimeout(begin, intervalMs * 2)
        return
      }
      if (!dialogPending && startRetries < MAX_START_RETRIES) {
        startRetries += 1
        pollTimer = setTimeout(begin, intervalMs)
        return
      }
      status.value = 'error'
      running = false
      release()
      return
    }
    startRetries = 0
    permissionWaitRetries = 0
    session = {
      interval: response.data?.interval ?? intervalMs,
      time: response.data?.time ?? timeMs,
    }
    status.value = 'tracking'
    scheduleRenewal()
    void poll()
  }

  function start(): void {
    if (!source) {
      status.value = 'unsupported'
      return
    }
    if (running) return
    running = true
    void begin()
  }

  function stop(): void {
    if (!running) return
    running = false
    generation += 1
    release()
    status.value = 'idle'
    // No stop message exists; the native session self-expires within `time`.
  }

  if (options.immediate) start()

  // Suspend while hidden (battery + no wasted polls). Every refocus runs one
  // fresh start round, which also revives the loop after the user granted
  // the permission in system settings. A 1001 denial skips it: the
  // contract forbids more calls in that run.
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stop()
    } else if (status.value !== 'denied' && status.value !== 'unsupported' && !running) {
      start()
    }
  })
  onScopeDispose(stop)

  return { status, point, coordType, permission, start, stop }
}

/**
 * True when the URL asks for the browser geolocation transport; the hash
 * query wins over the outer search, like the debug page params do. Read only
 * on the debug server, where it makes the fallback drivable with the debug
 * capture running.
 */
function debugGeolocationOverride(): boolean {
  const layers = [new URLSearchParams(window.location.search)]
  const separator = window.location.hash.indexOf('?')
  if (separator >= 0) layers.push(new URLSearchParams(window.location.hash.slice(separator + 1)))
  let asked: string | null = null
  for (const query of layers) asked = query.get('location-source') ?? asked
  return asked === 'geolocation'
}

/**
 * Picks the transport for a page: the real bridge when native injected one,
 * the debug simulation in dev and on the DevServer (so ego-browser runs
 * work), and the browser's geolocation in plain H5. On the debug server,
 * `?location-source=geolocation` forces the browser source ahead of the
 * bridge (the debug bridge answers location itself, so the override is the
 * only way to drive the fallback there); production never reads it.
 */
export function createPageLocationSource(center: {
  lng: number
  lat: number
}): RealtimeLocationSource | null {
  if (isWebviewDebug() && debugGeolocationOverride()) return browserLocationSource()
  if (isSupportBridge()) return bridgeSource()
  if (import.meta.env.DEV || isWebviewDebug()) return debugLocationSource(center)
  return browserLocationSource()
}
