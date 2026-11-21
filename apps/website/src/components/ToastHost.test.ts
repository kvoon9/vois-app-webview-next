// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createApp } from 'vue'

function createAnimationStub() {
  return {
    cancel() {},
    pause() {},
    commitStyles() {},
    currentTime: 0,
    startTime: 0,
    onfinish: null,
  }
}

if (!('getAnimations' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
}

if (!('animate' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: () => createAnimationStub(),
  })
}

Element.prototype.scrollIntoView = () => {}
Element.prototype.checkVisibility = () => true

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

window.ResizeObserver = ResizeObserverStub

type MountedToastHost = {
  app: ReturnType<typeof createApp>
  host: HTMLElement
}

let mounted: MountedToastHost | null = null

afterEach(() => {
  mounted?.app.unmount()
  mounted?.host.remove()
  mounted = null
})

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 30))

async function mountToastHost() {
  // The toaster is module-level, so a fresh module graph starts every case empty.
  vi.resetModules()
  const { useToast } = await import('~/composables/useToast')
  const { default: ToastHost } = await import('./ToastHost.vue')
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(ToastHost)
  app.mount(host)
  mounted = { app, host }
  return useToast()
}

function toastElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="toast"]')
}

function shownToast(): HTMLElement {
  const element = toastElement()
  if (!element) throw new Error('toast is missing')
  return element
}

describe('ToastHost', () => {
  it('shows the message passed to showToast', async () => {
    const { showToast } = await mountToastHost()
    showToast('Saved')
    await flush()

    expect(shownToast().textContent).toContain('Saved')
  })

  it('replaces the visible toast instead of stacking', async () => {
    const { showToast } = await mountToastHost()
    showToast('First')
    await flush()
    showToast('Second')
    await flush()

    expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(1)
    expect(shownToast().textContent).toContain('Second')
  })

  it('exposes each toast type through data-type', async () => {
    const { showToast } = await mountToastHost()
    showToast('Saved')
    await flush()
    expect(shownToast().dataset.type).toBe('success')

    showToast('Failed', { type: 'error' })
    await flush()
    expect(shownToast().dataset.type).toBe('error')

    showToast('Note', { type: 'info' })
    await flush()
    expect(shownToast().dataset.type).toBe('info')
  })

  it('dismisses the toast when it is clicked', async () => {
    const { showToast } = await mountToastHost()
    showToast('Saved')
    await flush()

    shownToast().click()
    await flush()

    expect(toastElement()).toBeNull()
  })

  it('keeps a zero or infinite duration toast on screen', async () => {
    const { showToast } = await mountToastHost()
    showToast('Zero', { duration: 0 })
    await flush()
    expect(shownToast().textContent).toContain('Zero')

    showToast('Forever', { duration: Number.POSITIVE_INFINITY })
    await flush()
    expect(shownToast().textContent).toContain('Forever')
  })
})
