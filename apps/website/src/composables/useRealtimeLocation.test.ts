import { EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { debugLocationSource, useRealtimeLocation } from './useRealtimeLocation'
import {
  LOCATION_ERR_INVALID,
  LOCATION_ERR_PERMISSION_DENIED,
  type BridgeLocation,
  type GetLocationResponse,
  type StartLocationResponse,
} from '~/utils/bridge/location-bridge'

// The composable only reaches the real bridge when no test source is passed,
// but the module graph still pulls these in; keep them inert under test.
vi.mock('~/composables/useWebviewBridge', () => ({ whenWebviewBridge: async () => null }))
vi.mock('~/composables/useWebviewDebug', () => ({ isWebviewDebug: () => false }))

afterEach(() => vi.useRealTimers())

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
    start: vi.fn(async (_interval: number, _time: number): Promise<StartLocationResponse> =>
      ok({ interval: _interval, time: _time }),
    ),
    get: vi.fn(async (): Promise<GetLocationResponse> => ok({ location: fix(1000) })),
  }
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

  it('locks out every start after native denies the permission', async () => {
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

    api.start()
    api.stop()
    api.start()
    await flush()

    expect(source.start).toHaveBeenCalledOnce()
    expect(source.get).not.toHaveBeenCalled()
    expect(api.status.value).toBe('denied')
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
