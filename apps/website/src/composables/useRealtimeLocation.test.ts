import { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  browserLocationSource,
  debugLocationSource,
  useRealtimeLocation,
} from './useRealtimeLocation'
import { wgs84ToGcj02 } from '~/utils/coords'
import {
  LOCATION_ERR_INVALID,
  LOCATION_ERR_PERMISSION_DENIED,
  type BridgeLocation,
  type GetLocationRes,
  type StartLocationRes,
} from '~/utils/bridge/location-bridge'

// The composable only reaches the real bridge when no test source is passed,
// but the module graph still pulls these in; keep them inert under test.
vi.mock('~/composables/useWebviewBridge', () => ({ whenWebviewBridge: async () => null }))
vi.mock('~/composables/useWebviewDebug', () => ({ isWebviewDebug: () => false }))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** An OK bridge answer around `data`. */
const ok = <T>(data: T) => ({ errcode: 0, errmsg: 'ok', data })

/** One GPS fix as the app would report it; only `time` varies between tests. */
function fix(time: number): BridgeLocation {
  return {
    latitude: 31.2,
    longitude: 121.4,
    altitude: null,
    accuracy: 20,
    speed: 1.5,
    bearing: null,
    time,
    name: null,
    address: null,
  }
}

/** A transport double that answers every start and get until a test overrides it. */
function fakeSource() {
  return {
    permissions: vi.fn(async (): Promise<{ granted: boolean } | null> => ({ granted: true })),
    start: vi.fn(async (_interval: number, _time: number): Promise<StartLocationRes> =>
      ok({ interval: _interval, time: _time }),
    ),
    get: vi.fn(async (): Promise<GetLocationRes> => ok({ location: fix(1000) })),
    stop: vi.fn(),
  }
}

/** Browser permission error codes; anything but 1 is a transient failure. */
const GEO_ERR_PERMISSION_DENIED = 1
const GEO_ERR_POSITION_UNAVAILABLE = 2

/**
 * A push-based geolocation double: the test fires success or error into the
 * registered watch and reads back what the source did with it.
 */
function fakeGeolocation() {
  const watches: Array<{
    onFix: (position: GeolocationPosition) => void
    onError: (error: GeolocationPositionError) => void
    options: PositionOptions
  }> = []
  const cleared: number[] = []
  let nextId = 1
  return {
    watches,
    cleared,
    watchPosition: vi.fn(
      (
        onFix: (position: GeolocationPosition) => void,
        onError: (error: GeolocationPositionError) => void,
        options: PositionOptions,
      ) => {
        watches.push({ onFix, onError, options })
        return nextId++
      },
    ),
    clearWatch: vi.fn((id: number) => {
      cleared.push(id)
    }),
  }
}

type FakeGeolocation = ReturnType<typeof fakeGeolocation>

/** A permission status the source can await. */
function permissionStatus(state: PermissionState) {
  // SAFETY: the source only reads `state` off the status object.
  return Promise.resolve({ state } as PermissionStatus)
}

/** A permissions API answering `state` for every query, or throwing when asked. */
function permissionsApi(state: PermissionState | 'throw'): Permissions {
  const query = ({ name }: { name: string }) => {
    if (state === 'throw') throw new Error(`unsupported query ${name}`)
    return permissionStatus(state)
  }
  // SAFETY: the source only calls query({name:'geolocation'}).
  const permissions = { query } as Permissions
  return permissions
}

/**
 * Stubs the global navigator with the fake geolocation; pass a permissions API
 * for the probe tests, or none to model an engine without one.
 */
function stubNavigator(geo: FakeGeolocation, permissions?: Permissions) {
  const stubbed = { geolocation: geo, permissions }
  if (!permissions) delete stubbed.permissions
  vi.stubGlobal('navigator', stubbed)
}

/** A browser fix pushed into the watch; only the GPS coordinates matter. */
function fireFix(geo: FakeGeolocation, lng: number, lat: number, time: number): void {
  // SAFETY: the watch callback only reads coords and timestamp; a full
  // GeolocationPosition adds nothing the source could observe.
  const position = {
    coords: {
      longitude: lng,
      latitude: lat,
      altitude: 12.5,
      accuracy: 20,
      speed: 1.5,
      heading: 45,
    },
    timestamp: time,
  } as GeolocationPosition
  geo.watches.at(-1)!.onFix(position)
}

/** A browser error pushed into the watch. */
function fireError(geo: FakeGeolocation, code: number, message: string): void {
  // SAFETY: the error callback only reads code and message.
  const error = { code, message } as GeolocationPositionError
  geo.watches.at(-1)!.onError(error)
}

/** Lets the start/poll promise chains settle before the next timer move. */
const flush = () => vi.advanceTimersByTimeAsync(0)

/**
 * Minimal document double: `useEventListener` only needs an EventTarget, and
 * the composable only reads `visibilityState` when the event fires.
 */
class FakeDocument extends EventTarget {
  visibilityState: 'visible' | 'hidden' = 'visible'
}

let doc: FakeDocument

beforeEach(() => {
  doc = new FakeDocument()
  vi.stubGlobal('document', doc)
  vi.useFakeTimers()
})

/** Wraps a composable in its own scope, as a component would. */
function setup(...args: Parameters<typeof useRealtimeLocation>) {
  const scope = new EffectScope()
  const api = scope.run(() => useRealtimeLocation(...args))
  if (!api) throw new Error('effect scope returned nothing')
  return { scope, api }
}

describe('useRealtimeLocation', () => {
  it('opens a session with the defaults, then polls as soon as it tracks', async () => {
    const source = fakeSource()
    const { scope, api } = setup({ source })

    expect(api.status.value).toBe('idle')
    api.start()
    await flush()

    expect(api.status.value).toBe('tracking')
    expect(api.permission.value).toBe('granted')
    expect(source.start).toHaveBeenCalledOnce()
    expect(source.start).toHaveBeenCalledWith(5000, 30000)
    expect(source.get).toHaveBeenCalledOnce()
    expect(api.point.value).toEqual(fix(1000))
    scope.stop()
  })

  it('clamps the request into native bounds before sending start', async () => {
    const source = fakeSource()
    const { scope, api } = setup({ source, intervalMs: 1000, timeMs: 120000 })

    api.start()
    await flush()

    expect(source.start).toHaveBeenCalledOnce()
    expect(source.start).toHaveBeenCalledWith(5000, 60000)
    scope.stop()
  })

  it('keeps the newest fix and rides out stale answers and null ones', async () => {
    const source = fakeSource()
    const first = fix(1000)
    source.get
      .mockResolvedValueOnce(ok({ location: first }))
      .mockResolvedValueOnce(ok({ location: fix(500) }))
      .mockResolvedValueOnce(ok({ location: null }))
    const { scope, api } = setup({ source })

    api.start()
    await flush()
    expect(api.point.value).toEqual(first)

    await vi.advanceTimersByTimeAsync(5000)
    expect(api.point.value).toEqual(first)

    await vi.advanceTimersByTimeAsync(5000)
    expect(api.point.value).toEqual(first)
    expect(source.get).toHaveBeenCalledTimes(3)
    scope.stop()
  })

  it('reopens the session when get reports it expired', async () => {
    const source = fakeSource()
    source.get
      .mockResolvedValueOnce(ok({ location: fix(1000) }))
      .mockResolvedValueOnce({ errcode: LOCATION_ERR_INVALID, errmsg: 'expired' })
      .mockResolvedValue(ok({ location: fix(2000) }))
    const { scope, api } = setup({ source })

    api.start()
    await flush()
    expect(source.start).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(5000)

    expect(source.start).toHaveBeenCalledTimes(2)
    expect(source.start).toHaveBeenLastCalledWith(5000, 30000)
    expect(api.status.value).toBe('tracking')
    expect(api.point.value).toEqual(fix(2000))
    expect(source.get).toHaveBeenCalledTimes(3)
    scope.stop()
  })

  it('sends start-location unconditionally while the probe says off', async () => {
    const source = fakeSource()
    source.permissions.mockResolvedValue({ granted: false })
    let resolveStart: (v: StartLocationRes) => void = () => {}
    source.start.mockImplementationOnce(() => new Promise((r) => (resolveStart = r)))
    const { scope, api } = setup({ source })

    api.start()
    await flush()

    // The probe result is UI-only; the start call goes out regardless, and
    // the pending native answer keeps the loop in its starting state.
    expect(source.start).toHaveBeenCalledOnce()
    expect(api.status.value).toBe('starting')
    expect(api.permission.value).toBe('denied')

    resolveStart(ok({ interval: 5000, time: 30000 }))
    await flush()
    expect(api.status.value).toBe('tracking')
    scope.stop()
  })

  it('stops after a native 1001 and revives on an explicit retry', async () => {
    const source = fakeSource()
    source.start.mockResolvedValue({
      errcode: LOCATION_ERR_PERMISSION_DENIED,
      errmsg: 'denied',
    })
    const { scope, api } = setup({ source })

    api.start()
    await flush()

    expect(api.status.value).toBe('denied')
    expect(source.start).toHaveBeenCalledOnce()
    expect(source.get).not.toHaveBeenCalled()

    source.start.mockResolvedValue(ok({ interval: 5000, time: 30000 }))
    api.start()
    await flush()

    expect(api.status.value).toBe('tracking')
    expect(source.start).toHaveBeenCalledTimes(2)
    expect(source.get).toHaveBeenCalledOnce()
    scope.stop()
  })

  it('skips the refocus round after a denial until the user retries', async () => {
    const source = fakeSource()
    source.start.mockResolvedValue({
      errcode: LOCATION_ERR_PERMISSION_DENIED,
      errmsg: 'denied',
    })
    const { scope, api } = setup({ source })

    api.start()
    await flush()
    expect(api.status.value).toBe('denied')

    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    await flush()
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    await flush()

    // The contract forbids more calls in this run; refocus must not re-ask.
    expect(api.status.value).toBe('denied')
    expect(source.start).toHaveBeenCalledOnce()

    source.start.mockResolvedValue(ok({ interval: 5000, time: 30000 }))
    api.start()
    await flush()
    expect(api.status.value).toBe('tracking')
    scope.stop()
  })

  it('treats an unavailable permission answer as unknown and still tracks', async () => {
    const source = fakeSource()
    source.permissions.mockResolvedValue(null)
    const { scope, api } = setup({ source })

    api.start()
    await flush()

    expect(api.status.value).toBe('tracking')
    expect(api.permission.value).toBe('unknown')
    expect(source.start).toHaveBeenCalledOnce()
    scope.stop()
  })

  it('revives from the error state: a retry start reaches the bridge again', async () => {
    const source = fakeSource()
    source.start.mockResolvedValue({ errcode: LOCATION_ERR_INVALID, errmsg: 'refused' })
    const { scope, api } = setup({ source })

    api.start()
    // 1 call + 3 retries at 5s intervals, then the loop gives up.
    await vi.advanceTimersByTimeAsync(20_000)
    expect(api.status.value).toBe('error')
    expect(source.start).toHaveBeenCalledTimes(4)

    source.start.mockResolvedValue(ok({ interval: 5000, time: 30000 }))
    api.start()
    await flush()

    expect(api.status.value).toBe('tracking')
    expect(source.start).toHaveBeenCalledTimes(5)
    scope.stop()
  })

  it('stops polling for good once stop clears the timers', async () => {
    const source = fakeSource()
    const { scope, api } = setup({ source })

    api.start()
    await flush()
    expect(api.status.value).toBe('tracking')
    expect(source.get).toHaveBeenCalledTimes(1)

    api.stop()
    expect(api.status.value).toBe('idle')
    await vi.advanceTimersByTimeAsync(60000)

    expect(source.get).toHaveBeenCalledTimes(1)
    expect(source.start).toHaveBeenCalledOnce()
    scope.stop()
  })

  it('suspends while the page hides and restarts on return', async () => {
    const source = fakeSource()
    const { scope, api } = setup({ source })

    api.start()
    await flush()
    expect(source.get).toHaveBeenCalledTimes(1)

    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(api.status.value).toBe('idle')
    await vi.advanceTimersByTimeAsync(60000)
    expect(source.get).toHaveBeenCalledTimes(1)

    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(api.status.value).toBe('tracking')
    expect(source.start).toHaveBeenCalledTimes(2)
    expect(source.get).toHaveBeenCalledTimes(2)
    scope.stop()
  })

  it('stops when the owning scope is disposed', async () => {
    const source = fakeSource()
    const { scope, api } = setup({ source })

    api.start()
    await flush()
    expect(source.get).toHaveBeenCalledTimes(1)

    scope.stop()
    expect(api.status.value).toBe('idle')
    await vi.advanceTimersByTimeAsync(60000)

    expect(source.get).toHaveBeenCalledTimes(1)
    expect(source.start).toHaveBeenCalledOnce()
  })
})

describe('debugLocationSource', () => {
  it('refuses get before start, circles the center after, and expires', async () => {
    const source = debugLocationSource({ lng: 121.4, lat: 31.2 })

    await expect(source.permissions()).resolves.toEqual({ granted: true })
    await expect(source.get()).resolves.toMatchObject({ errcode: LOCATION_ERR_INVALID })

    await expect(source.start(5000, 30000)).resolves.toMatchObject({ errcode: 0 })
    const answer = await source.get()
    expect(answer.errcode).toBe(0)
    expect(answer.data?.location).toMatchObject({
      latitude: expect.closeTo(31.2, 5),
      longitude: expect.closeTo(121.402, 5),
    })

    vi.advanceTimersByTime(30001)
    await expect(source.get()).resolves.toMatchObject({ errcode: LOCATION_ERR_INVALID })
  })
})

describe('browserLocationSource', () => {
  it('returns null when the browser exposes no geolocation', () => {
    vi.stubGlobal('navigator', {})
    expect(browserLocationSource()).toBeNull()
  })

  it('holds start while the prompt is unanswered and releases on the first fix', async () => {
    const geo = fakeGeolocation()
    stubNavigator(geo)
    const source = browserLocationSource()!

    const start = source.start(5000, 30000)
    fireFix(geo, 114.0668, 22.6305, 1000)
    await expect(start).resolves.toMatchObject({ errcode: 0, errmsg: 'browser' })

    expect(geo.watches.length).toBe(1)
    expect(geo.watches[0]!.options).toEqual({ enableHighAccuracy: true, maximumAge: 5000 })

    const answer = await source.get()
    const golden = wgs84ToGcj02(114.0668, 22.6305)
    expect(answer.data?.coordType).toBe('gcj02')
    expect(answer.data?.location).toEqual({
      latitude: golden.lat,
      longitude: golden.lng,
      altitude: 12.5,
      accuracy: 20,
      speed: 1.5,
      bearing: 45,
      time: 1000,
      name: null,
      address: null,
    })
  })

  it('answers get with no fix as 0 and null, and with no watch as invalid', async () => {
    const geo = fakeGeolocation()
    stubNavigator(geo)
    const source = browserLocationSource()!

    const start = source.start(5000, 30000)
    // A transient error opens the session even before any fix exists.
    fireError(geo, GEO_ERR_POSITION_UNAVAILABLE, 'unavailable')
    await expect(start).resolves.toMatchObject({ errcode: 0 })

    await expect(source.get()).resolves.toMatchObject({
      errcode: 0,
      data: { coordType: 'gcj02', location: null },
    })

    source.stop?.()
    await expect(source.get()).resolves.toMatchObject({ errcode: LOCATION_ERR_INVALID })
  })

  it('settles a denied start with 1001, kills the watch, and re-registers on retry', async () => {
    const geo = fakeGeolocation()
    stubNavigator(geo)
    const source = browserLocationSource()!

    const denied = source.start(5000, 30000)
    fireError(geo, GEO_ERR_PERMISSION_DENIED, 'User denied Geolocation')
    await expect(denied).resolves.toMatchObject({ errcode: LOCATION_ERR_PERMISSION_DENIED })
    expect(geo.cleared).toEqual([1])
    await expect(source.get()).resolves.toMatchObject({ errcode: LOCATION_ERR_PERMISSION_DENIED })

    const retry = source.start(5000, 30000)
    fireFix(geo, 121.4, 31.2, 2000)
    await expect(retry).resolves.toMatchObject({ errcode: 0 })
    expect(geo.watchPosition).toHaveBeenCalledTimes(2)
    await expect(source.get()).resolves.toMatchObject({ errcode: 0 })
  })

  it('echoes a renewal while watching without re-registering the watch', async () => {
    const geo = fakeGeolocation()
    stubNavigator(geo)
    const source = browserLocationSource()!

    const start = source.start(5000, 30000)
    fireFix(geo, 114.0668, 22.6305, 1000)
    await start

    await expect(source.start(5000, 30000)).resolves.toMatchObject({
      errcode: 0,
      data: { interval: 5000, time: 30000 },
    })
    expect(geo.watchPosition).toHaveBeenCalledOnce()
  })

  it('stop clears the watch, unblocks a held start, and starts a fresh fix cache', async () => {
    const geo = fakeGeolocation()
    stubNavigator(geo)
    const source = browserLocationSource()!

    const settled = source.start(5000, 30000)
    fireFix(geo, 114.0668, 22.6305, 1000)
    await settled

    source.stop?.()
    expect(geo.cleared).toEqual([1])

    const held = source.start(5000, 30000)
    source.stop?.()
    await expect(held).resolves.toMatchObject({ errcode: LOCATION_ERR_INVALID })

    // No watch means not running; a fresh start clears the fix cache.
    await expect(source.get()).resolves.toMatchObject({ errcode: LOCATION_ERR_INVALID })
    const restart = source.start(5000, 30000)
    fireFix(geo, 116.4, 39.9, 3000)
    await restart
    const answer = await source.get()
    expect(answer.data?.location?.latitude).toBe(wgs84ToGcj02(116.4, 39.9).lat)
  })

  it('maps the permission query for granted, denied, prompt, and a throw', async () => {
    const geo = fakeGeolocation()
    stubNavigator(geo, permissionsApi('granted'))
    await expect(browserLocationSource()!.permissions()).resolves.toEqual({ granted: true })

    stubNavigator(geo, permissionsApi('denied'))
    await expect(browserLocationSource()!.permissions()).resolves.toEqual({ granted: false })

    stubNavigator(geo, permissionsApi('prompt'))
    await expect(browserLocationSource()!.permissions()).resolves.toBeNull()

    stubNavigator(geo, permissionsApi('throw'))
    await expect(browserLocationSource()!.permissions()).resolves.toBeNull()
  })

  it('answers a pending start with -1 once stop settles it', async () => {
    const geo = fakeGeolocation()
    stubNavigator(geo)
    const source = browserLocationSource()!

    const held = source.start(5000, 30000)
    source.stop?.()
    await expect(held).resolves.toMatchObject({ errcode: LOCATION_ERR_INVALID })
    // The watch the start just registered is exactly what stop released.
    expect(geo.clearWatch).toHaveBeenCalledOnce()
  })
})

describe('useRealtimeLocation with the browser source', () => {
  function setupBrowser() {
    const geo = fakeGeolocation()
    stubNavigator(geo)
    const source = browserLocationSource()!
    const { scope, api } = setup({ source })
    return { geo, source, scope, api }
  }

  it('stays starting while the prompt is unanswered, then tracks the first fix', async () => {
    const { geo, scope, api } = setupBrowser()

    api.start()
    await flush()
    expect(api.status.value).toBe('starting')
    expect(api.point.value).toBeNull()

    fireFix(geo, 114.0668, 22.6305, 1000)
    await flush()
    expect(api.status.value).toBe('tracking')
    expect(api.coordType.value).toBe('gcj02')
    const golden = wgs84ToGcj02(114.0668, 22.6305)
    expect(api.point.value).toMatchObject({ longitude: golden.lng, latitude: golden.lat })

    // Past the renewal point the session renews without re-registering.
    await vi.advanceTimersByTimeAsync(26_000)
    expect(api.status.value).toBe('tracking')
    expect(geo.watchPosition).toHaveBeenCalledOnce()
    scope.stop()
  })

  it('opens the session on a transient error and never spins the reopen path', async () => {
    const geo = fakeGeolocation()
    stubNavigator(geo)
    const source = browserLocationSource()!
    // A begin() spin would call start again; counting start, not the watch
    // registration, is what catches it (a spin echoes without re-registering).
    const starts = vi.spyOn(source, 'start')
    const { scope, api } = setup({ source })

    api.start()
    fireError(geo, GEO_ERR_POSITION_UNAVAILABLE, 'unavailable')
    await flush()
    expect(api.status.value).toBe('tracking')
    expect(starts).toHaveBeenCalledOnce()

    // Polls keep answering 0 with no fix; no new begin() round may appear.
    await vi.advanceTimersByTimeAsync(20_000)
    expect(api.status.value).toBe('tracking')
    expect(api.point.value).toBeNull()
    expect(starts).toHaveBeenCalledOnce()
    scope.stop()
  })

  it('lands in denied on a code-1 error and re-registers the watch on retry', async () => {
    const { geo, scope, api } = setupBrowser()

    api.start()
    fireError(geo, GEO_ERR_PERMISSION_DENIED, 'User denied Geolocation')
    await flush()
    expect(api.status.value).toBe('denied')
    expect(geo.cleared).toEqual([1])

    api.start()
    expect(geo.watchPosition).toHaveBeenCalledTimes(2)
    fireFix(geo, 121.4, 31.2, 2000)
    await flush()
    expect(api.status.value).toBe('tracking')
    scope.stop()
  })

  it('clears the watch when the page hides and registers a fresh one on return', async () => {
    const { geo, scope, api } = setupBrowser()

    api.start()
    fireFix(geo, 114.0668, 22.6305, 1000)
    await flush()

    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(geo.cleared).toEqual([1])

    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(geo.watchPosition).toHaveBeenCalledTimes(2)
    fireFix(geo, 114.0668, 22.6305, 3000)
    await flush()
    expect(api.status.value).toBe('tracking')
    scope.stop()
  })

  it('clears the watch from the poll denial path and from stop', async () => {
    const { geo, scope, api } = setupBrowser()

    api.start()
    fireFix(geo, 114.0668, 22.6305, 1000)
    await flush()
    fireError(geo, GEO_ERR_PERMISSION_DENIED, 'User denied Geolocation')
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.status.value).toBe('denied')
    expect(geo.cleared).toEqual([1])

    api.start()
    fireFix(geo, 121.4, 31.2, 2000)
    await flush()
    api.stop()
    expect(geo.cleared).toEqual([1, 2])
    scope.stop()
  })
})

describe('the loop releasing its source', () => {
  it('calls stop at every halt: stop, the 1001 paths, and the terminal error', async () => {
    const source = fakeSource()
    const { scope, api } = setup({ source })

    // stop() while never started must not call the transport.
    api.stop()
    expect(source.stop).not.toHaveBeenCalled()

    // begin() denial path.
    source.start.mockResolvedValueOnce({
      errcode: LOCATION_ERR_PERMISSION_DENIED,
      errmsg: 'denied',
    })
    api.start()
    await flush()
    expect(source.stop).toHaveBeenCalledOnce()

    // poll() denial path (a get that answers 1001 after tracking).
    source.start.mockResolvedValueOnce(ok({ interval: 5000, time: 30000 }))
    source.get.mockResolvedValueOnce(ok({ location: fix(1000) }))
    api.start()
    await flush()
    source.get.mockResolvedValueOnce({ errcode: LOCATION_ERR_PERMISSION_DENIED, errmsg: 'denied' })
    await vi.advanceTimersByTimeAsync(5000)
    expect(source.stop).toHaveBeenCalledTimes(2)

    // Terminal error path: start answered -1 four times.
    source.start.mockResolvedValue({ errcode: LOCATION_ERR_INVALID, errmsg: 'refused' })
    api.start()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(source.stop).toHaveBeenCalledTimes(3)
    scope.stop()
  })
})
