import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

/** The token and the boot-load promise live in module state, so each case gets its own. */
async function loadModule(): Promise<typeof import('./access-token')> {
  vi.resetModules()
  return import('./access-token')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('access token', () => {
  it('reports nothing before the boot load settles', async () => {
    const { getAccessToken } = await loadModule()
    expect(getAccessToken()).toBe('')
  })

  it('hands the bridge token to a waiting request', async () => {
    const { whenAccessToken, resolveBridgeAccessToken } = await loadModule()
    const pending = whenAccessToken()
    resolveBridgeAccessToken('tok')
    await expect(pending).resolves.toBe('tok')
  })

  it('serves an already-resolved token without waiting again', async () => {
    const { whenAccessToken, resolveBridgeAccessToken } = await loadModule()
    resolveBridgeAccessToken('tok')
    await expect(whenAccessToken()).resolves.toBe('tok')
  })

  it('rejects once the boot load ended without a token', async () => {
    const { whenAccessToken, resolveBridgeAccessToken } = await loadModule()
    resolveBridgeAccessToken(undefined)
    await expect(whenAccessToken()).rejects.toThrow('登录信息不可用')
  })

  it('keeps a working token when a later answer is empty', async () => {
    const { getAccessToken, resolveBridgeAccessToken } = await loadModule()
    resolveBridgeAccessToken('tok')
    resolveBridgeAccessToken(null)
    resolveBridgeAccessToken('')
    expect(getAccessToken()).toBe('tok')
  })
})
