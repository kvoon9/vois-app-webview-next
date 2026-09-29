import { Bridge } from '@vois/webview-bridge'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { fetchPageParams, mergePageParams, type PageParamsBridgeSource } from './usePageParams'

/** A real bridge wired to a fake native; `answer` decides what native replies. */
function bridgeWithNative(answer: (type: string) => string | undefined): Bridge {
  return Bridge.create((type, _data, onResponse) => {
    const raw = answer(type)
    if (raw !== undefined) onResponse?.(raw)
  })
}

function sourceWith(bridge: Bridge, supported = true): PageParamsBridgeSource {
  return { supported, whenReady: async () => bridge }
}

/** Native's default payload; auth fields are ordinary scalars here, not filtered. */
const NATIVE_DEFAULTS = {
  errcode: 0,
  errmsg: 'ok',
  data: {
    'access-token': 'tok',
    'login-id': '441',
    lang: 'zh-CN',
    'device-type': 'android',
  },
}

describe('fetchPageParams', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('asks for the named fields and returns native defaults including the token', async () => {
    const sent = vi.fn()
    const bridge = Bridge.create((name, data, onResponse) => {
      sent(name, data)
      onResponse?.(JSON.stringify(NATIVE_DEFAULTS))
    })

    await expect(fetchPageParams(sourceWith(bridge), '/shared/qrcode/x')).resolves.toEqual(
      NATIVE_DEFAULTS.data,
    )
    expect(sent).toHaveBeenCalledWith('get-page-params', {
      page: '/shared/qrcode/x',
      params: [],
    })
  })

  it('forwards requested names verbatim, auth fields included', async () => {
    const sent = vi.fn()
    const bridge = Bridge.create((name, data, onResponse) => {
      sent(name, data)
      onResponse?.(
        JSON.stringify({ errcode: 0, errmsg: 'ok', data: { 'access-token': 'tok', uuid: 'x' } }),
      )
    })

    await expect(
      fetchPageParams(sourceWith(bridge), '/shared/qrcode/x', ['access-token', 'uuid']),
    ).resolves.toEqual({ 'access-token': 'tok', uuid: 'x' })
    expect(sent).toHaveBeenCalledWith('get-page-params', {
      page: '/shared/qrcode/x',
      params: ['access-token', 'uuid'],
    })
  })

  it('preserves every scalar auth field alongside the other values', async () => {
    const mixed = sourceWith(
      bridgeWithNative(() =>
        JSON.stringify({
          errcode: 0,
          errmsg: 'ok',
          data: {
            'access-token': 7,
            accessToken: 'camel',
            token: true,
            'login-id': '441',
          },
        }),
      ),
    )

    await expect(fetchPageParams(mixed, '/shared/qrcode/x')).resolves.toEqual({
      'access-token': '7',
      accessToken: 'camel',
      token: 'true',
      'login-id': '441',
    })
  })

  it('returns nothing outside the app without waiting', async () => {
    const whenReady = vi.fn()
    await expect(
      fetchPageParams({ supported: false, whenReady }, '/shared/qrcode/x'),
    ).resolves.toEqual({})
    expect(whenReady).not.toHaveBeenCalled()
  })

  it('returns nothing when native never answers', async () => {
    const silent = sourceWith(bridgeWithNative(() => undefined))
    await expect(fetchPageParams(silent, '/shared/qrcode/x', [], 1)).resolves.toEqual({})
  })

  it('returns nothing when the answer is unparseable', async () => {
    const garbage = sourceWith(bridgeWithNative(() => 'not json'))
    await expect(fetchPageParams(garbage, '/shared/qrcode/x')).resolves.toEqual({})
  })

  it('returns nothing when native answers with an error code', async () => {
    const failing = sourceWith(
      bridgeWithNative(() => JSON.stringify({ errcode: 31, errmsg: 'auth expired' })),
    )
    await expect(fetchPageParams(failing, '/shared/qrcode/x')).resolves.toEqual({})
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

    await expect(fetchPageParams(mixed, '/shared/qrcode/x')).resolves.toEqual({
      'device-type': '3',
      'pay-method': 'true',
    })
  })
})

describe('mergePageParams', () => {
  const fromBridge = {
    'access-token': 'tok',
    accessToken: 'camel',
    token: 'plain',
    'login-id': '441',
    uuid: 'from-native',
  }

  it('lets the route query outrank what native sent', () => {
    expect(mergePageParams(fromBridge, { uuid: '0140c6a1' })).toEqual({
      ...fromBridge,
      uuid: '0140c6a1',
    })
  })

  it('keeps native values, auth fields included, when the query has no such key', () => {
    expect(mergePageParams(fromBridge, {})).toEqual(fromBridge)
  })

  it('lets the route query outrank native for auth fields too', () => {
    expect(
      mergePageParams(fromBridge, { 'access-token': 'query-tok', token: 'query-plain' }),
    ).toEqual({
      ...fromBridge,
      'access-token': 'query-tok',
      token: 'query-plain',
    })
  })

  it('ignores non-string query values and keeps the first of a repeated key', () => {
    expect(mergePageParams({}, { uuid: ['a', 'b'], hole: null })).toEqual({
      uuid: 'a',
    })
  })
})
