import { Bridge } from '@vois/webview-bridge'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { nativeLang, nativeTheme } from '~/constants'
import {
  createPageParamsStore,
  fetchPageParams,
  PAGE_PARAMS_TIMEOUT_MS,
  type PageParamsBridgeSource,
} from './usePageParams'

afterEach(() => vi.useRealTimers())

/** A real bridge wired to a fake native; `answer` decides what native replies. */
function bridgeWithNative(answer: (type: string) => string | undefined): Bridge {
  return Bridge.create((type, _data, onResponse) => {
    const raw = answer(type)
    if (raw !== undefined) onResponse?.(raw)
  })
}

function sourceWith(bridge: Bridge, supported = true): PageParamsBridgeSource {
  return { supported: () => supported, whenReady: async () => bridge }
}

/** An OK answer around `data`; the bridge parses JSON strings, so tests send strings. */
function okAnswer(data: Record<string, string>): string {
  return JSON.stringify({ errcode: 0, errmsg: 'ok', data })
}

/** Lets queued microtasks and the bridge's own promises settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/** A bridge that records native callbacks, so a test decides when each read answers. */
function deferredBridge() {
  const sent = vi.fn()
  const answers: Array<(raw: string) => void> = []
  const bridge = Bridge.create((type, data, onResponse) => {
    sent(type, data)
    if (onResponse) answers.push(onResponse)
  })
  return { bridge, sent, answers }
}

describe('fetchPageParams', () => {
  it('accepts a native response after the former three-second deadline', async () => {
    vi.useFakeTimers()
    const bridge = Bridge.create((_type, _data, onResponse) => {
      setTimeout(() => onResponse?.(okAnswer({ 'login-id': '441' })), 4000)
    })
    const reading = fetchPageParams(sourceWith(bridge), '/settings/friends', ['login-id'])
    await vi.advanceTimersByTimeAsync(4000)
    await expect(reading).resolves.toEqual({ 'login-id': '441' })
  })

  it('still times out when a ready native bridge stays silent', async () => {
    vi.useFakeTimers()
    const reading = fetchPageParams(sourceWith(Bridge.create(() => {})), '/settings/friends')
    const failure = expect(reading).rejects.toMatchObject({ reason: 'timeout' })
    await vi.advanceTimersByTimeAsync(PAGE_PARAMS_TIMEOUT_MS)
    await failure
  })
  it('asks for the named fields and returns native defaults including the token', async () => {
    const sent = vi.fn()
    const bridge = Bridge.create((type, data, onResponse) => {
      sent(type, data)
      onResponse?.(
        JSON.stringify({
          errcode: 0,
          errmsg: 'ok',
          data: { 'access-token': 'tok', 'login-id': '441', lang: 'zh-CN' },
        }),
      )
    })

    await expect(fetchPageParams(sourceWith(bridge), '/shared/qrcode/x')).resolves.toEqual({
      'access-token': 'tok',
      'login-id': '441',
      lang: 'zh-CN',
    })
    expect(sent).toHaveBeenCalledWith('get-page-params', {
      page: '/shared/qrcode/x',
      params: [],
    })
  })

  it('checks support at fetch time, so a late debug bridge still counts', async () => {
    let supported = false
    const sent = vi.fn()
    const bridge = Bridge.create((type, _data, onResponse) => {
      sent(type)
      onResponse?.(okAnswer({ lang: 'zh-CN' }))
    })
    const source: PageParamsBridgeSource = {
      supported: () => supported,
      whenReady: async () => bridge,
    }

    await expect(fetchPageParams(source, '/a')).resolves.toEqual({})
    expect(sent).not.toHaveBeenCalled()

    supported = true
    await expect(fetchPageParams(source, '/a')).resolves.toEqual({ lang: 'zh-CN' })
    expect(sent).toHaveBeenCalledOnce()
  })

  it('rejects with unavailable when the app never handed over a bridge', async () => {
    await expect(
      fetchPageParams({ supported: () => true, whenReady: async () => undefined }, '/a'),
    ).rejects.toMatchObject({ reason: 'unavailable' })
  })

  it('rejects with timeout when native never answers', async () => {
    const never = new Promise<Bridge>(() => {})
    const source: PageParamsBridgeSource = { supported: () => true, whenReady: () => never }
    await expect(fetchPageParams(source, '/a', [], 1)).rejects.toMatchObject({ reason: 'timeout' })
  })

  it('rejects with invalid when the answer is not a usable object', async () => {
    const garbage = sourceWith(bridgeWithNative(() => 'not json'))
    await expect(fetchPageParams(garbage, '/a')).rejects.toMatchObject({ reason: 'invalid' })

    const array = sourceWith(bridgeWithNative(() => '[]'))
    await expect(fetchPageParams(array, '/a')).rejects.toMatchObject({ reason: 'invalid' })
  })

  it('rejects with native and the code when native answers with an error', async () => {
    const failing = sourceWith(
      bridgeWithNative(() => JSON.stringify({ errcode: 31, errmsg: 'auth expired' })),
    )
    await expect(fetchPageParams(failing, '/a')).rejects.toMatchObject({
      reason: 'native',
      nativeCode: 31,
    })
  })

  it('stringifies scalar values and drops nested ones', async () => {
    const mixed = sourceWith(
      bridgeWithNative(() =>
        JSON.stringify({
          errcode: 0,
          errmsg: 'ok',
          data: { 'device-type': 3, 'pay-method': true, nested: { a: 1 } },
        }),
      ),
    )

    await expect(fetchPageParams(mixed, '/a')).resolves.toEqual({
      'device-type': '3',
      'pay-method': 'true',
    })
  })
})

describe('createPageParamsStore', () => {
  it('loads the new page without waiting for the previous page to answer', async () => {
    const { bridge, sent, answers } = deferredBridge()
    const store = createPageParamsStore(sourceWith(bridge))
    store.observe('/a', ['login-id'])
    await flush()
    store.observe('/b', ['login-id'])
    await flush()
    expect(sent).toHaveBeenCalledTimes(2)
    answers[1]?.(okAnswer({ 'login-id': '456' }))
    await flush()
    expect(store.status.value).toBe('ready')
    expect(store.params.value['login-id']).toBe('456')
    answers[0]?.(okAnswer({ 'login-id': '441' }))
    await flush()
    expect(store.params.value['login-id']).toBe('456')
    expect(store.status.value).toBe('ready')
  })
  it('shares an in-flight read when another consumer asks for the same fields', async () => {
    const { bridge, sent, answers } = deferredBridge()
    const store = createPageParamsStore(sourceWith(bridge))
    store.observe('/settings/friends', ['login-id'])
    await flush()
    store.observe('/settings/friends', ['login-id'])
    answers[0]?.(okAnswer({ 'login-id': '441' }))
    await flush()
    expect(sent).toHaveBeenCalledOnce()
    expect(store.status.value).toBe('ready')
  })

  it('keeps a successful read when a later consumer needs no new fields', async () => {
    const { bridge, sent, answers } = deferredBridge()
    const store = createPageParamsStore(sourceWith(bridge))
    store.observe('/settings/friends', ['login-id'])
    await flush()
    answers[0]?.(okAnswer({ 'login-id': '441' }))
    await flush()
    store.observe('/settings/friends')
    await flush()
    expect(sent).toHaveBeenCalledOnce()
    expect(store.status.value).toBe('ready')
    expect(store.params.value['login-id']).toBe('441')
  })
  it('reads the page and asks for its names plus the shell names', async () => {
    const { bridge, sent, answers } = deferredBridge()
    const store = createPageParamsStore(sourceWith(bridge))

    store.observe('/a', ['uuid'])
    await flush()
    answers[0]?.(okAnswer({ uuid: 'x' }))
    await flush()

    expect(sent).toHaveBeenCalledWith('get-page-params', {
      page: '/a',
      params: ['theme', 'lang', 'uuid'],
    })
    expect(store.params.value).toEqual({ uuid: 'x' })
    expect(store.status.value).toBe('ready')
    expect(store.error.value).toBeNull()
  })

  it('batches same-tick observes into one request with the union of names', async () => {
    const { bridge, sent, answers } = deferredBridge()
    const store = createPageParamsStore(sourceWith(bridge))

    store.observe('/a', ['uuid'])
    store.observe('/a', ['name'])
    await flush()

    expect(sent).toHaveBeenCalledOnce()
    expect(sent).toHaveBeenCalledWith('get-page-params', {
      page: '/a',
      params: ['theme', 'lang', 'uuid', 'name'],
    })
    answers[0]?.(okAnswer({ uuid: 'x', name: 'n' }))
    await flush()
    expect(store.params.value).toEqual({ uuid: 'x', name: 'n' })
  })

  it('reruns once with the union when names arrive mid-flight', async () => {
    const { bridge, sent, answers } = deferredBridge()
    const store = createPageParamsStore(sourceWith(bridge))

    store.observe('/a', ['uuid'])
    await flush()
    store.observe('/a', ['name'])
    answers[0]?.(okAnswer({ uuid: 'x' }))
    await flush()

    expect(sent).toHaveBeenCalledTimes(2)
    expect(sent).toHaveBeenLastCalledWith('get-page-params', {
      page: '/a',
      params: ['theme', 'lang', 'uuid', 'name'],
    })
    answers[1]?.(okAnswer({ uuid: 'x', name: 'n' }))
    await flush()

    expect(sent).toHaveBeenCalledTimes(2)
    expect(store.params.value).toEqual({ uuid: 'x', name: 'n' })
  })

  it('retires a pending read when reload starts a new generation', async () => {
    const { bridge, sent, answers } = deferredBridge()
    const store = createPageParamsStore(sourceWith(bridge))

    store.observe('/a', ['uuid'])
    await flush()

    const reloading = store.reload()
    answers[0]?.(okAnswer({ uuid: 'stale' }))
    await flush()

    // The retired answer must not land, and the reload is the second request.
    expect(store.params.value).toEqual({})
    expect(sent).toHaveBeenCalledTimes(2)

    answers[1]?.(okAnswer({ uuid: 'fresh' }))
    await reloading

    expect(store.params.value).toEqual({ uuid: 'fresh' })
    expect(store.status.value).toBe('ready')
  })

  it('clears the old page and drops its late answer', async () => {
    const { bridge, answers } = deferredBridge()
    const store = createPageParamsStore(sourceWith(bridge))

    store.observe('/a', ['uuid'])
    await flush()
    store.observe('/b', ['uuid'])
    await flush()

    expect(store.params.value).toEqual({})
    expect(store.status.value).toBe('pending')

    answers[0]?.(okAnswer({ uuid: 'from-a' }))
    await flush()
    expect(store.params.value).toEqual({})
    expect(store.status.value).toBe('pending')

    answers[1]?.(okAnswer({ uuid: 'from-b' }))
    await flush()
    expect(store.params.value).toEqual({ uuid: 'from-b' })
    expect(store.status.value).toBe('ready')
  })

  it('reports a failed reload and keeps the values it already had', async () => {
    const { bridge, answers } = deferredBridge()
    const store = createPageParamsStore(sourceWith(bridge))

    store.observe('/a', ['uuid'])
    await flush()
    answers[0]?.(okAnswer({ uuid: 'x' }))
    await flush()

    const reloading = store.reload()
    await flush()
    answers[1]?.(JSON.stringify({ errcode: 31, errmsg: 'auth expired' }))
    await reloading

    expect(store.status.value).toBe('error')
    expect(store.error.value?.reason).toBe('native')
    expect(store.error.value?.nativeCode).toBe(31)
    expect(store.params.value).toEqual({ uuid: 'x' })
  })

  it('does nothing before any observe', async () => {
    const { bridge, sent } = deferredBridge()
    const store = createPageParamsStore(sourceWith(bridge))

    await expect(store.reload()).resolves.toBeUndefined()
    expect(sent).not.toHaveBeenCalled()
  })

  it('feeds native theme and language to the app shell', async () => {
    nativeTheme.value = null
    nativeLang.value = null
    const { bridge, answers } = deferredBridge()
    const store = createPageParamsStore(sourceWith(bridge))

    store.observe('/a')
    await flush()
    answers[0]?.(okAnswer({ theme: 'dark', lang: 'zh-CN' }))
    await flush()

    expect(nativeTheme.value).toBe('dark')
    expect(nativeLang.value).toBe('zh-CN')
  })
})
