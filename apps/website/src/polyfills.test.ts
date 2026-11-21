// @vitest-environment jsdom
// The boot polyfills run before the app and must install the two Chrome 84
// APIs the UI SDK calls unguarded. jsdom lacks getAnimations, so importing
// the module here exercises its install path exactly as the Chrome 70 floor
// does; jsdom shares Node's native WeakRef, which only lets us assert the
// polyfill leaves a present API untouched. The WeakRef install path itself
// is proven by the real-engine Chrome 70 probe.
import { describe, expect, it } from 'vite-plus/test'

describe('boot polyfills on the Chrome 70 floor', () => {
  it('installs a getAnimations shim that ends the popup close wait', async () => {
    expect('getAnimations' in Element.prototype).toBe(false)
    await import('./polyfills')
    expect('getAnimations' in Element.prototype).toBe(true)
    expect(document.body.getAnimations()).toEqual([])
  })

  it('leaves a natively present WeakRef untouched', async () => {
    await import('./polyfills')
    const held = { account: 'probe' }
    expect(new window.WeakRef(held).deref()).toBe(held)
  })
})
