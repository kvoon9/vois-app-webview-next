import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const startLogin = vi.fn(function WebSocket() {
  throw new Error('synthetic login attempt')
})

beforeEach(async () => {
  vi.resetModules()
  await import('vue')
  startLogin.mockClear()
  vi.stubGlobal('navigator', { userAgent: 'Desktop QA' })
  vi.stubGlobal('WebSocket', startLogin)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('fixed-account fallback environment', () => {
  it('never attempts fixed-account login in production', async () => {
    vi.stubEnv('DEV', false)
    vi.stubGlobal('document', { querySelector: () => null })
    const { bridge } = await import('./index')

    await expect(bridge.getAccessToken()).rejects.toMatchObject({ code: 'BRIDGE_UNAVAILABLE' })
    expect(startLogin).not.toHaveBeenCalled()
  })

  it('allows the fallback in dev without a native bridge', async () => {
    vi.stubEnv('DEV', true)
    vi.stubGlobal('document', { querySelector: () => null })
    const { bridge } = await import('./index')

    await expect(bridge.getAccessToken()).rejects.toThrow('synthetic login attempt')
    expect(startLogin).toHaveBeenCalledOnce()
  })

  it('allows the fallback in a debug preview of a production build', async () => {
    vi.stubEnv('DEV', false)
    const querySelector = vi.fn(() => ({}))
    vi.stubGlobal('document', { querySelector })
    const { bridge } = await import('./index')

    await expect(bridge.getAccessToken()).rejects.toThrow('synthetic login attempt')
    expect(querySelector).toHaveBeenCalledWith('script[src="/__debug/client.js"]')
    expect(startLogin).toHaveBeenCalledOnce()
  })
})
