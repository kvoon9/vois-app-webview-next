// @vitest-environment jsdom
import { checkPattern } from '@ui-sdk/core/testing'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { createApp, h, shallowRef } from 'vue'
import ToggleSwitch from './ToggleSwitch.vue'

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

let active: { app: ReturnType<typeof createApp>; host: HTMLElement } | null = null

afterEach(() => {
  active?.app.unmount()
  active?.host.remove()
  active = null
})

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 30))

function mountSwitch(checked: boolean, disabled = false) {
  const value = shallowRef(checked)
  const changes: boolean[] = []
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () =>
      h(ToggleSwitch, {
        checked: value.value,
        disabled,
        ariaLabel: 'Location sharing',
        onChange: () => {
          changes.push(true)
          value.value = !value.value
        },
      }),
  })
  app.mount(host)
  active = { app, host }
  return { value, changes }
}

function switchButton(): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>('[role="switch"]')
  if (!el) throw new Error('switch is missing')
  return el
}

function switchThumb(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[data-slot="switch-thumb"]')
  if (!el) throw new Error('switch thumb is missing')
  return el
}

describe('ToggleSwitch', () => {
  it('reflects the checked prop and applies the accessible name', async () => {
    const { value } = mountSwitch(false)

    expect(switchButton().getAttribute('aria-checked')).toBe('false')
    expect(switchButton().getAttribute('aria-label')).toBe('Location sharing')

    value.value = true
    await flush()

    expect(switchButton().getAttribute('aria-checked')).toBe('true')
  })

  it('reports exactly one change per press', async () => {
    const { changes } = mountSwitch(false)

    switchButton().click()
    await flush()

    expect(changes).toHaveLength(1)
  })

  it('does not report a press while disabled', async () => {
    const { changes } = mountSwitch(false, true)
    const el = switchButton()

    expect(el.disabled).toBe(true)
    el.click()
    await flush()

    expect(changes).toHaveLength(0)
  })

  it('slides the knob with the checked value', async () => {
    const { value } = mountSwitch(false)

    expect(switchThumb().classList.contains('translate-x-0')).toBe(true)
    expect(switchThumb().classList.contains('translate-x-5')).toBe(false)

    switchButton().click()
    await flush()

    expect(value.value).toBe(true)
    expect(switchThumb().classList.contains('translate-x-5')).toBe(true)
    expect(switchThumb().classList.contains('translate-x-0')).toBe(false)
  })

  it('meets the switch pattern', async () => {
    mountSwitch(false)
    await flush()

    await checkPattern(switchButton(), 'switch')
  })
})
