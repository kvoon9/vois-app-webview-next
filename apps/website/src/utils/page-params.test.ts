import { Bridge } from '@vois/webview-bridge'
import { describe, expect, it, vi } from 'vite-plus/test'
import {
  fetchPageParams,
  objectRows,
  queryRows,
  withTimeout,
  type PageParamsBridgeSource,
  type PageParamsResponse,
} from './page-params'

const OK: PageParamsResponse = {
  errcode: 0,
  errmsg: 'ok',
  data: { mode: 'ai', retries: 2 },
}

/**
 * Real bridge wired to a fake native. `answer` decides what native replies;
 * returning `undefined` means native never calls back, the case the page has
 * to survive.
 */
function bridgeWithNative(answer: (type: string) => string | undefined): Bridge {
  return Bridge.create((type, _data, onResponse) => {
    const raw = answer(type)
    if (raw !== undefined) onResponse?.(raw)
  })
}

function sourceWith(bridge: Bridge, supported = true): PageParamsBridgeSource {
  return { supported, whenReady: async () => bridge }
}

/** Source whose native channel never becomes ready. */
function neverReady(): PageParamsBridgeSource {
  return { supported: true, whenReady: () => new Promise(() => {}) }
}

describe('queryRows', () => {
  it('lists each key with its value', () => {
    expect(queryRows({ 'login-id': '441', name: 'Ada' })).toEqual([
      { key: 'login-id', value: '441' },
      { key: 'name', value: 'Ada' },
    ])
  })

  it('keeps repeated keys in one comma-joined row', () => {
    expect(queryRows({ tag: ['a', 'b'] })).toEqual([{ key: 'tag', value: 'a, b' }])
  })

  it('renders a valueless key as an empty string', () => {
    expect(queryRows({ flag: null })).toEqual([{ key: 'flag', value: '' }])
  })

  it('is empty without a query', () => {
    expect(queryRows({})).toEqual([])
  })
})

describe('objectRows', () => {
  it('renders each field as JSON text', () => {
    expect(objectRows({ mode: 'ai', nested: { n: 1 }, missing: null })).toEqual([
      { key: 'mode', value: '"ai"' },
      { key: 'nested', value: '{"n":1}' },
      { key: 'missing', value: 'null' },
    ])
  })

  it('is empty for absent or empty params', () => {
    expect(objectRows(undefined)).toEqual([])
    expect(objectRows({})).toEqual([])
  })
})

describe('withTimeout', () => {
  it('passes the settled value through', async () => {
    await expect(withTimeout(Promise.resolve('done'), 50)).resolves.toBe('done')
  })

  it('resolves undefined instead of hanging', async () => {
    await expect(withTimeout(new Promise<void>(() => {}), 1)).resolves.toBeUndefined()
  })
})

describe('fetchPageParams', () => {
  it('sends the page path and returns the params native answers with', async () => {
    const type = vi.fn()
    const bridge = Bridge.create((name, _data, onResponse) => {
      type(name)
      onResponse?.(JSON.stringify(OK))
    })

    await expect(fetchPageParams(sourceWith(bridge), '/settings/x')).resolves.toEqual({
      status: 'ok',
      response: OK,
    })
    expect(type).toHaveBeenCalledWith('get-page-params')
  })

  it('reports unsupported outside the app without waiting', async () => {
    const whenReady = vi.fn()
    await expect(fetchPageParams({ supported: false, whenReady }, '/settings/x')).resolves.toEqual({
      status: 'unsupported',
    })
    expect(whenReady).not.toHaveBeenCalled()
  })

  it('reports failure when the native channel never becomes ready', async () => {
    await expect(fetchPageParams(neverReady(), '/settings/x', 1)).resolves.toEqual({
      status: 'failed',
    })
  })

  it('reports failure when native never answers', async () => {
    const silent = bridgeWithNative(() => undefined)
    await expect(fetchPageParams(sourceWith(silent), '/settings/x', 1)).resolves.toEqual({
      status: 'failed',
    })
  })

  it('reports failure when native answers with something unparseable', async () => {
    const garbage = bridgeWithNative(() => 'not json')
    await expect(fetchPageParams(sourceWith(garbage), '/settings/x')).resolves.toEqual({
      status: 'failed',
    })
  })

  it("surfaces native's own message when it answers with an error code", async () => {
    const errorEnvelope = bridgeWithNative(() =>
      JSON.stringify({ errcode: 31, errmsg: 'auth expired' }),
    )
    await expect(fetchPageParams(sourceWith(errorEnvelope), '/settings/x')).resolves.toEqual({
      status: 'failed',
      detail: '31: auth expired',
    })
  })
})
