// @env browser

import { onScopeDispose, shallowRef, ref, type Ref, type ShallowRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import { isSupportBridge } from '@vois/webview-bridge'
import { whenWebviewBridge } from '~/composables/useWebviewBridge'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import {
  LOCATION_ERR_INVALID,
  LOCATION_ERR_PERMISSION_DENIED,
  LOCATION_MAX_TIME_MS,
  LOCATION_MIN_INTERVAL_MS,
  type BridgeLocation,
  type GetLocationResponse,
  type StartLocationResponse,
} from '~/utils/bridge/location-bridge'

/** Lifecycle of the polling loop. */
export type RealtimeLocationStatus =
  | 'idle'
  | 'starting'
  | 'tracking'
  /** Native denied the permission; only a settings change can revive it. */
  | 'denied'
  /** No native bridge and no debug simulation available. */
  | 'unsupported'
  | 'error'

/** Transport the loop talks to: the real bridge, a debug simulation, or a test double. */
export interface RealtimeLocationSource {
  start(intervalMs: number, timeMs: number): Promise<StartLocationResponse>
  get(): Promise<GetLocationResponse>
}

/** How long a `get-location` call may take before the poll counts as missed. */
const GET_TIMEOUT_MS = 5_000
/** A `start-location` may wait on the permission dialog, so it gets a long leash. */
const START_TIMEOUT_MS = 90_000
/** Retries for a `-1` start answer (e.g. a dialog from an earlier page still pending). */
const MAX_START_RETRIES = 3

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

/** The real transport: uniBridgeCall over the injected native bridge. */
function bridgeSource(): RealtimeLocationSource {
  return {
    async start(intervalMs, timeMs) {
      const bridge = await whenWebviewBridge()
      if (!bridge) throw new Error('bridge unavailable')
      const response = await bridge.request('start-location', {
        interval: intervalMs,
        time: timeMs,
      })
      // SAFETY: the protocol map declares this response shape for 'start-location'.
      return response as StartLocationResponse
    },
    async get() {
      const bridge = await whenWebviewBridge()
      if (!bridge) throw new Error('bridge unavailable')
      const response = await bridge.request('get-location', {})
      // SAFETY: the protocol map declares this response shape for 'get-location'.
      return response as GetLocationResponse
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
  start: () => void
  stop: () => void
}

/**
 * Polls the device's realtime location over the bridge. The H5 owns the loop:
 * `start-location` opens a bounded session, `get-location` is polled at the
 * interval, and the session is renewed just before it expires so fixes never
 * stop while the page is visible. Hidden tabs suspend polling; the page's
 * scope disposal stops it for good.
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

  let running = false
  let session = { interval: intervalMs, time: timeMs }
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let renewTimer: ReturnType<typeof setTimeout> | undefined
  let startRetries = 0
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

  async function begin(): Promise<void> {
    if (!running || !source) return
    status.value = 'starting'
    const current = ++generation
    const response = await withTimeout(source.start(intervalMs, timeMs), START_TIMEOUT_MS, null)
    if (!running || current !== generation) return
    if (response === null) {
      status.value = 'error'
      return
    }
    if (response.errcode === LOCATION_ERR_PERMISSION_DENIED) {
      status.value = 'denied'
      running = false
      return
    }
    if (response.errcode !== 0) {
      // `-1`: a permission request is still pending or params were refused.
      if (startRetries < MAX_START_RETRIES) {
        startRetries += 1
        pollTimer = setTimeout(begin, intervalMs)
      } else {
        status.value = 'error'
      }
      return
    }
    startRetries = 0
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
    if (running || status.value === 'denied') return
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

  // Suspend while hidden (battery + no wasted polls), resume on return.
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stop()
    } else if (status.value !== 'denied' && status.value !== 'unsupported' && !running) {
      start()
    }
  })
  onScopeDispose(stop)

  return { status, point, coordType, start, stop }
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
