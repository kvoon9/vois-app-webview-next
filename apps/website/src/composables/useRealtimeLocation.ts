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
  /** No native bridge and no debug simulation available. */
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
      return
    }
    if (response.errcode === LOCATION_ERR_PERMISSION_DENIED) {
      // Explicit denial: the contract stops start and get for this run.
      status.value = 'denied'
      running = false
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
    clearTimers()
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
 * Picks the transport for a page: the real bridge, or the DevServer debug
 * simulation when no native injected one (so ego-browser runs work).
 */
export function createPageLocationSource(center: {
  lng: number
  lat: number
}): RealtimeLocationSource | null {
  if (isSupportBridge()) return bridgeSource()
  if (import.meta.env.DEV || isWebviewDebug()) return debugLocationSource(center)
  return null
}
