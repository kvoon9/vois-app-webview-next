// @vitest-environment jsdom
import { checkPattern } from '@ui-sdk/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createApp, h, nextTick, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import TrackCalendarModal from './TrackCalendarModal.vue'

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

const testingStyles = document.createElement('style')
testingStyles.setAttribute('data-ui-sdk-testing', '')
testingStyles.textContent = '[popover][data-open]{display:block!important}'
document.head.append(testingStyles)

function createTestI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        modal: { cancel: 'Cancel', ok: 'OK' },
        device: { selectDate: 'Select date' },
      },
    },
  })
}

let active: { app: ReturnType<typeof createApp>; host: HTMLElement } | null = null

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0))
})

afterEach(() => {
  active?.app.unmount()
  active?.host.remove()
  active = null
  vi.useRealTimers()
})

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 30))

function mountCalendar(options: { open?: boolean; value: string }) {
  const open = shallowRef(options.open ?? true)
  const value = shallowRef(options.value)
  const cancels: number[] = []
  const confirms: string[] = []
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () =>
      h(TrackCalendarModal, {
        open: open.value,
        value: value.value,
        onCancel: () => {
          cancels.push(1)
          open.value = false
        },
        onConfirm: (date: string) => {
          confirms.push(date)
          open.value = false
        },
      }),
  })
  app.use(createTestI18n())
  app.mount(host)
  active = { app, host }
  return { open, cancels, confirms }
}

function dialogContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="dialog-content"]')
}

function calendarDays(): HTMLElement[] {
  const content = dialogContent()
  if (!content) return []
  return Array.from(content.querySelectorAll<HTMLElement>('[data-slot="calendar-day"]'))
}

function calendarDay(value: string): HTMLElement {
  const day = calendarDays().find((element) => element.getAttribute('data-value') === value)
  if (!day) throw new Error(`calendar day ${value} is missing`)
  return day
}

function footerButton(label: string): HTMLButtonElement {
  const content = dialogContent()
  const button = Array.from(content?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
    (element) => element.textContent?.trim() === label,
  )
  if (!button) throw new Error(`${label} button is missing`)
  return button
}

describe('TrackCalendarModal', () => {
  it('opens with the given date selected', async () => {
    mountCalendar({ open: true, value: '2026-11-10' })
    await flush()

    expect(dialogContent()?.querySelector('[data-slot="dialog-title"]')?.textContent).toContain(
      'Select date',
    )
    expect(calendarDay('2026-11-10').hasAttribute('data-selected')).toBe(true)
  })

  it('moves the selection when another day is pressed', async () => {
    mountCalendar({ open: true, value: '2026-11-10' })
    await flush()

    calendarDay('2026-11-05').click()
    await nextTick()

    expect(calendarDay('2026-11-05').hasAttribute('data-selected')).toBe(true)
    expect(calendarDay('2026-11-10').hasAttribute('data-selected')).toBe(false)
  })

  it('makes days after today unavailable and leaves the selection alone', async () => {
    mountCalendar({ open: true, value: '2026-11-10' })
    await flush()

    expect(calendarDay('2026-11-16').hasAttribute('data-unavailable')).toBe(false)
    expect(calendarDay('2026-11-17').hasAttribute('data-unavailable')).toBe(true)

    calendarDay('2026-11-17').click()
    await nextTick()

    expect(calendarDay('2026-11-10').hasAttribute('data-selected')).toBe(true)
  })

  it('confirms the selected ISO date', async () => {
    const { confirms } = mountCalendar({ open: true, value: '2026-11-10' })
    await flush()

    calendarDay('2026-11-05').click()
    await nextTick()
    footerButton('OK').click()
    await flush()

    expect(confirms).toEqual(['2026-11-05'])
  })

  it('cancels from the footer button', async () => {
    const { open, cancels } = mountCalendar({ open: true, value: '2026-11-10' })
    await flush()

    footerButton('Cancel').click()
    await flush()

    expect(cancels).toHaveLength(1)
    expect(open.value).toBe(false)
    expect(dialogContent()).toBeNull()
  })

  it('closes on Escape and reports the cancel', async () => {
    const { open, cancels } = mountCalendar({ open: true, value: '2026-11-10' })
    await flush()

    dialogContent()?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await flush()

    expect(cancels).toHaveLength(1)
    expect(open.value).toBe(false)
    expect(dialogContent()).toBeNull()
  })

  it('resets the selection to the open value when reopened', async () => {
    const { open } = mountCalendar({ open: true, value: '2026-11-10' })
    await flush()

    calendarDay('2026-11-05').click()
    await nextTick()
    footerButton('Cancel').click()
    await flush()
    expect(dialogContent()).toBeNull()

    open.value = true
    await flush()

    expect(calendarDay('2026-11-10').hasAttribute('data-selected')).toBe(true)
    expect(calendarDay('2026-11-05').hasAttribute('data-selected')).toBe(false)
  })

  it('meets the dialog pattern', async () => {
    // jsdom has no trigger, but the dialog still records the focused element to return focus to.
    const returnFocus = document.createElement('button')
    document.body.append(returnFocus)
    returnFocus.focus()

    mountCalendar({ open: true, value: '2026-11-10' })
    await flush()

    const content = dialogContent()
    if (!content) throw new Error('dialog content is missing')
    await checkPattern(content, 'dialog')
    returnFocus.remove()
  })
})
