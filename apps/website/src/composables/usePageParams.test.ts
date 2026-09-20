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

/** Native's default payload, the shape `params: []` is answered with. */
const DEFAULTS = {
  errcode: 0,
  errmsg: 'ok',
  data: { 'access-token': 'tok', 'login-id': '441', lang: 'zh-CN', 'device-type': 'android' },
}

describe('fetchPageParams', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('asks for the named fields and returns native defaults', async () => {
    const sent = vi.fn()
    const bridge = Bridge.create((name, data, onResponse) => {
      sent(name, data)
      onResponse?.(JSON.stringify(DEFAULTS))
    })

    await expect(fetchPageParams(sourceWith(bridge), '/shared/qrcode/x')).resolves.toEqual(
      DEFAULTS.data,
    )
    expect(sent).toHaveBeenCalledWith('get-page-params', {
      page: '/shared/qrcode/x',
      params: [],
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
  const fromBridge = { 'access-token': 'tok', 'login-id': '441', uuid: 'from-native' }

  it('lets the route query outrank what native sent', () => {
    expect(mergePageParams(fromBridge, { uuid: '0140c6a1' })).toEqual({
      'access-token': 'tok',
      'login-id': '441',
      uuid: '0140c6a1',
    })
  })

  it('keeps the bridge value when the query has no such key', () => {
    expect(mergePageParams(fromBridge, {})).toEqual(fromBridge)
  })

  it('ignores non-string query values and keeps the first of a repeated key', () => {
    expect(mergePageParams({}, { uuid: ['a', 'b'], hole: null })).toEqual({
      uuid: 'a',
    })
  })
})
