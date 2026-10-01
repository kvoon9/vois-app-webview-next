import { Bridge } from '@vois/webview-bridge'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createAppBridge } from './client'
import type { AppBridgeError } from './errors'
import type { BridgeSource } from './types'

const TOKEN = 'synthetic'
const DEFAULT_PAGE = '/qa'

/** Native's success envelope for the token read; the value sits under the protocol key. */
function answerWithToken(token: string): string {
  return JSON.stringify({ errcode: 0, errmsg: '', data: { 'access-token': token } })
}

const OK = answerWithToken(TOKEN)

/** A real bridge over a native stub; `answer` decides what each request receives. */
function bridgeWith(answer: (type: string) => string | undefined): Bridge {
  return Bridge.create((type, _data, onResponse) => {
    const raw = answer(type)
    if (raw !== undefined) onResponse?.(raw)
  })
}

/** A native stub whose response callbacks the test releases one dispatch at a time. */
function controllableBridge() {
  const responders: Array<(raw: string) => void> = []
  const dispatch = vi.fn()
  const bridge = Bridge.create((type, data, onResponse) => {
    dispatch(type, data)
    if (onResponse) responders.push(onResponse)
  })
  return { bridge, dispatch, responders }
}

function sourceWith(
  bridge: Bridge,
  supported = true,
  getPage: () => string = () => DEFAULT_PAGE,
  login?: () => Promise<string>,
): BridgeSource {
  return { supported: () => supported, whenReady: async () => bridge, getPage, login }
}

describe('createAppBridge', () => {
  it('uses explicit sign-in without consulting native or fixed-account login', async () => {
    const supported = vi.fn(() => true)
    const whenReady = vi.fn(async () => bridgeWith(() => OK))
    const login = vi.fn(async () => 'fixed-account')
    const app = createAppBridge({
      supported,
      whenReady,
      getPage: () => DEFAULT_PAGE,
      login,
      credentialToken: () => 'signed-in-account',
    })

    await expect(app.getAccessToken()).resolves.toBe('signed-in-account')
    await expect(app.getAccessToken()).resolves.toBe('signed-in-account')
    expect(supported).not.toHaveBeenCalled()
    expect(whenReady).not.toHaveBeenCalled()
    expect(login).not.toHaveBeenCalled()
  })

  it('replaces an in-flight native answer when explicit sign-in completes', async () => {
    const { bridge, responders } = controllableBridge()
    let token: string | undefined
    const app = createAppBridge({
      ...sourceWith(bridge),
      credentialToken: () => token,
    })
    const pending = app.getAccessToken()
    await vi.waitFor(() => expect(responders).toHaveLength(1))

    token = 'signed-in-account'
    await expect(app.getAccessToken()).resolves.toBe(token)
    responders[0]!(OK)
    await expect(pending).resolves.toBe(token)
  })

  it('does not fall back to native for an invalid explicit session', async () => {
    const supported = vi.fn(() => true)
    const login = vi.fn(async () => 'fixed-account')
    const app = createAppBridge({
      supported,
      whenReady: async () => bridgeWith(() => OK),
      getPage: () => DEFAULT_PAGE,
      login,
      credentialToken: () => '',
    })

    await expect(app.getAccessToken()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })
    expect(supported).not.toHaveBeenCalled()
    expect(login).not.toHaveBeenCalled()
  })

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads the token from page params with the page context and the token field', async () => {
    const sent = vi.fn()
    const bridge = Bridge.create((type, data, onResponse) => {
      sent(type, data)
      onResponse?.(OK)
    })

    await expect(createAppBridge(sourceWith(bridge)).getAccessToken()).resolves.toBe(TOKEN)
    expect(sent).toHaveBeenCalledWith('get-page-params', {
      page: DEFAULT_PAGE,
      params: ['access-token'],
    })
  })

  it('does not wait for a bridge in an unsupported environment', async () => {
    const whenReady = vi.fn()
    const app = createAppBridge({ supported: () => false, whenReady, getPage: () => DEFAULT_PAGE })

    await expect(app.getAccessToken()).rejects.toMatchObject({ code: 'BRIDGE_UNAVAILABLE' })
    expect(whenReady).not.toHaveBeenCalled()
  })

  it('reports unavailable when the ready wait ends without a bridge', async () => {
    const app = createAppBridge({
      supported: () => true,
      whenReady: async () => undefined,
      getPage: () => DEFAULT_PAGE,
    })

    await expect(app.getAccessToken()).rejects.toMatchObject({ code: 'BRIDGE_UNAVAILABLE' })
  })

  it('shares one in-flight read and starts fresh on the next call', async () => {
    const { bridge, dispatch, responders } = controllableBridge()
    const getPage = vi.fn(() => DEFAULT_PAGE)
    const app = createAppBridge(sourceWith(bridge, true, getPage))

    const first = app.getAccessToken()
    const second = app.getAccessToken()
    await vi.advanceTimersByTimeAsync(0)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(getPage).toHaveBeenCalledTimes(1)

    responders.shift()?.(answerWithToken('first'))
    await expect(first).resolves.toBe('first')
    await expect(second).resolves.toBe('first')

    const next = app.getAccessToken()
    await vi.advanceTimersByTimeAsync(0)
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(getPage).toHaveBeenCalledTimes(2)

    responders.shift()?.(answerWithToken('next'))
    await expect(next).resolves.toBe('next')
  })

  it('sends the page context captured for each new read', async () => {
    const sent = vi.fn()
    const bridge = Bridge.create((type, data, onResponse) => {
      sent(type, data)
      onResponse?.(OK)
    })
    let page = '/first'
    const app = createAppBridge(sourceWith(bridge, true, () => page))

    await expect(app.getAccessToken()).resolves.toBe(TOKEN)
    expect(sent).toHaveBeenLastCalledWith('get-page-params', {
      page: '/first',
      params: ['access-token'],
    })

    page = '/second'
    await expect(app.getAccessToken()).resolves.toBe(TOKEN)
    expect(sent).toHaveBeenLastCalledWith('get-page-params', {
      page: '/second',
      params: ['access-token'],
    })
    expect(sent).toHaveBeenCalledTimes(2)
  })

  it('captures the page before the native wait, not after it', async () => {
    let resolveReady: ((bridge: Bridge) => void) | undefined
    const whenReady = () =>
      new Promise<Bridge>((resolve) => {
        resolveReady = resolve
      })
    const sent = vi.fn()
    const bridge = Bridge.create((type, data, onResponse) => {
      sent(type, data)
      onResponse?.(OK)
    })
    let page = '/before'
    const app = createAppBridge({ supported: () => true, whenReady, getPage: () => page })

    const token = app.getAccessToken()
    page = '/after'
    resolveReady?.(bridge)

    await expect(token).resolves.toBe(TOKEN)
    expect(sent).toHaveBeenCalledWith('get-page-params', {
      page: '/before',
      params: ['access-token'],
    })
  })

  it('clears a failed read so a retry reaches native again', async () => {
    let answer = JSON.stringify({ errcode: 31, errmsg: 'auth expired' })
    const app = createAppBridge(sourceWith(bridgeWith(() => answer)))

    await expect(app.getAccessToken()).rejects.toMatchObject({ code: 'NATIVE_ERROR' })
    answer = OK
    await expect(app.getAccessToken()).resolves.toBe(TOKEN)
  })

  it('times out while the bridge is still waiting to become ready', async () => {
    const app = createAppBridge(
      {
        supported: () => true,
        whenReady: () => new Promise<never>(() => {}),
        getPage: () => DEFAULT_PAGE,
      },
      100,
    )
    const rejection = expect(app.getAccessToken()).rejects.toMatchObject({ code: 'BRIDGE_TIMEOUT' })

    await vi.advanceTimersByTimeAsync(100)
    await rejection
  })

  it('times out while the ready bridge is still waiting for native', async () => {
    const app = createAppBridge(sourceWith(bridgeWith(() => undefined)), 100)
    const rejection = expect(app.getAccessToken()).rejects.toMatchObject({ code: 'BRIDGE_TIMEOUT' })

    await vi.advanceTimersByTimeAsync(100)
    await rejection
  })

  it('uses a ten-second default budget for ready plus response', async () => {
    const app = createAppBridge({
      supported: () => true,
      whenReady: () => new Promise<never>(() => {}),
      getPage: () => DEFAULT_PAGE,
    })
    const outcomes: string[] = []
    void app.getAccessToken().then(
      () => outcomes.push('resolved'),
      (error: AppBridgeError) => outcomes.push(error.code),
    )

    await vi.advanceTimersByTimeAsync(9_999)
    expect(outcomes).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(outcomes).toEqual(['BRIDGE_TIMEOUT'])
  })

  it('does not dispatch a request when the bridge arrives after the ready timeout', async () => {
    let resolveReady: ((bridge: Bridge) => void) | undefined
    const whenReady = () =>
      new Promise<Bridge>((resolve) => {
        resolveReady = resolve
      })
    const sent = vi.fn()
    const bridge = Bridge.create((type, data, onResponse) => {
      sent(type, data)
      onResponse?.(OK)
    })
    const app = createAppBridge(
      { supported: () => true, whenReady, getPage: () => DEFAULT_PAGE },
      100,
    )

    const rejection = expect(app.getAccessToken()).rejects.toMatchObject({ code: 'BRIDGE_TIMEOUT' })
    await vi.advanceTimersByTimeAsync(100)
    await rejection

    resolveReady?.(bridge)
    await vi.advanceTimersByTimeAsync(0)
    expect(sent).not.toHaveBeenCalled()
  })

  it('ignores a late answer so it cannot leak into a newer read', async () => {
    const { bridge, dispatch, responders } = controllableBridge()
    const app = createAppBridge(sourceWith(bridge), 100)

    const stale = app.getAccessToken()
    const staleRejection = expect(stale).rejects.toMatchObject({ code: 'BRIDGE_TIMEOUT' })
    await vi.advanceTimersByTimeAsync(100)
    await staleRejection

    let freshSettled = false
    const fresh = app.getAccessToken().then((token) => {
      freshSettled = true
      return token
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(dispatch).toHaveBeenCalledTimes(2)

    responders.shift()?.(answerWithToken('stale'))
    await vi.advanceTimersByTimeAsync(0)
    expect(freshSettled).toBe(false)

    responders.shift()?.(answerWithToken('fresh'))
    await expect(fresh).resolves.toBe('fresh')
  })

  it('maps an unparseable body and an implausible envelope to the same protocol error', async () => {
    const garbage = createAppBridge(sourceWith(bridgeWith(() => 'not json')))
    await expect(garbage.getAccessToken()).rejects.toMatchObject({
      code: 'BRIDGE_INVALID_RESPONSE',
    })

    const notEnvelope = createAppBridge(sourceWith(bridgeWith(() => JSON.stringify({ ok: true }))))
    await expect(notEnvelope.getAccessToken()).rejects.toMatchObject({
      code: 'BRIDGE_INVALID_RESPONSE',
    })
  })

  it('treats a blank native token as missing auth when no login is configured', async () => {
    for (const token of ['', '   ']) {
      const app = createAppBridge(sourceWith(bridgeWith(() => answerWithToken(token))))
      await expect(app.getAccessToken()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })
    }
  })

  it('keeps native business errors separate and preserves the native code', async () => {
    const failing = createAppBridge(
      sourceWith(bridgeWith(() => JSON.stringify({ errcode: 31, errmsg: 'auth expired' }))),
    )

    await expect(failing.getAccessToken()).rejects.toMatchObject({
      code: 'NATIVE_ERROR',
      nativeCode: 31,
    })
  })

  it('uses a valid native token without touching the configured login', async () => {
    const login = vi.fn(async () => 'fallback')
    const app = createAppBridge(
      sourceWith(
        bridgeWith(() => OK),
        true,
        () => DEFAULT_PAGE,
        login,
      ),
    )

    await expect(app.getAccessToken()).resolves.toBe(TOKEN)
    expect(login).not.toHaveBeenCalled()
  })

  it('falls back exactly once for concurrent calls when native has no token', async () => {
    const { bridge, dispatch, responders } = controllableBridge()
    const login = vi.fn(async () => 'fallback')
    const app = createAppBridge(sourceWith(bridge, true, () => DEFAULT_PAGE, login))

    const first = app.getAccessToken()
    const second = app.getAccessToken()
    await vi.advanceTimersByTimeAsync(0)
    expect(dispatch).toHaveBeenCalledTimes(1)

    responders.shift()?.(answerWithToken('   '))
    await expect(first).resolves.toBe('fallback')
    await expect(second).resolves.toBe('fallback')
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('falls back when native answers with an error or no bridge is ready', async () => {
    const login = vi.fn(async () => 'fallback')
    const failing = createAppBridge(
      sourceWith(
        bridgeWith(() => JSON.stringify({ errcode: 31, errmsg: 'auth expired' })),
        true,
        () => DEFAULT_PAGE,
        login,
      ),
    )
    await expect(failing.getAccessToken()).resolves.toBe('fallback')

    const noBridge = createAppBridge({
      supported: () => true,
      whenReady: async () => undefined,
      getPage: () => DEFAULT_PAGE,
      login,
    })
    await expect(noBridge.getAccessToken()).resolves.toBe('fallback')
    expect(login).toHaveBeenCalledTimes(2)
  })

  it('falls back after the native read times out', async () => {
    const login = vi.fn(async () => 'fallback')
    const app = createAppBridge(
      sourceWith(
        bridgeWith(() => undefined),
        true,
        () => DEFAULT_PAGE,
        login,
      ),
      100,
    )

    const token = app.getAccessToken()
    await vi.advanceTimersByTimeAsync(100)
    await expect(token).resolves.toBe('fallback')
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('clears a failed login so a retry can fall back again', async () => {
    const loginDown = new Error('login down')
    const login = vi.fn().mockRejectedValueOnce(loginDown).mockResolvedValueOnce('fallback')
    const app = createAppBridge(
      sourceWith(
        bridgeWith(() => answerWithToken('')),
        true,
        () => DEFAULT_PAGE,
        login,
      ),
    )

    await expect(app.getAccessToken()).rejects.toThrow('login down')
    await expect(app.getAccessToken()).resolves.toBe('fallback')
    expect(login).toHaveBeenCalledTimes(2)
  })

  it('rejects when the configured login also returns no token', async () => {
    const login = vi.fn(async () => '   ')
    const app = createAppBridge(
      sourceWith(
        bridgeWith(() => answerWithToken('')),
        true,
        () => DEFAULT_PAGE,
        login,
      ),
    )

    await expect(app.getAccessToken()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })
    expect(login).toHaveBeenCalledTimes(1)
  })

  it('attempts native again on the next call so a recovered token wins', async () => {
    const answers = [answerWithToken('   '), answerWithToken('native-after')]
    const sent = vi.fn()
    const bridge = Bridge.create((type, data, onResponse) => {
      sent(type, data)
      onResponse?.(answers.shift() ?? OK)
    })
    const login = vi.fn(async () => 'fallback')
    const app = createAppBridge(sourceWith(bridge, true, () => DEFAULT_PAGE, login))

    await expect(app.getAccessToken()).resolves.toBe('fallback')
    await expect(app.getAccessToken()).resolves.toBe('native-after')
    expect(sent).toHaveBeenCalledTimes(2)
    expect(login).toHaveBeenCalledTimes(1)
  })
})
