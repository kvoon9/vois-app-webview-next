// @vitest-environment jsdom
import type { TrackMapPoint } from '~/utils/track'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { createApp, h, nextTick, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import TrackPointDrawer from './TrackPointDrawer.vue'

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

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

window.ResizeObserver = ResizeObserverStub

function createTestI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        modal: { close: 'Close' },
        device: {
          trackPoints: 'Track points',
          trackPointCount: '{count} points',
          trackPointListDescription: 'Every recorded point for the day, oldest first.',
          noTrackForDate: 'No track records',
        },
      },
    },
  })
}

const points: TrackMapPoint[] = [
  {
    lng: 116.397,
    lat: 39.908,
    rawLng: 116.397,
    rawLat: 39.908,
    radius: 0,
    coordType: 0,
    time: '2026-11-16 08:35:12',
  },
  {
    lng: 116.4,
    lat: 39.91,
    rawLng: 116.4,
    rawLat: 39.91,
    radius: 0,
    coordType: 0,
    time: '2026-11-16 09:12:45',
  },
]

let active: { app: ReturnType<typeof createApp>; host: HTMLElement } | null = null
let scrollCalls: Element[] = []

beforeEach(() => {
  scrollCalls = []
  Element.prototype.scrollIntoView = function (this: Element) {
    scrollCalls.push(this)
  }
})

afterEach(() => {
  active?.app.unmount()
  active?.host.remove()
  active = null
})

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 30))

function mountDrawer(options: { points: TrackMapPoint[]; selectedIndex?: number | null }) {
  const open = shallowRef(false)
  const selections: number[] = []
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () =>
      h(TrackPointDrawer, {
        points: options.points,
        selectedIndex: options.selectedIndex ?? null,
        dateLabel: '2026-11-16',
        open: open.value,
        'onUpdate:open': (value: boolean) => {
          open.value = value
        },
        onSelect: (index: number) => {
          selections.push(index)
        },
      }),
  })
  app.use(createTestI18n())
  app.mount(host)
  active = { app, host }
  return { open, selections }
}

function drawerContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="drawer-content"]')
}

function trackRows(): HTMLButtonElement[] {
  const content = drawerContent()
  if (!content) return []
  return Array.from(content.querySelectorAll<HTMLButtonElement>('[data-track-row]'))
}

async function openDrawer(open: { value: boolean }): Promise<void> {
  open.value = true
  await flush()
}

describe('TrackPointDrawer', () => {
  it('renders every point with its time and formatted coordinates', async () => {
    const { open } = mountDrawer({ points })

    await openDrawer(open)

    const content = drawerContent()
    expect(content).not.toBeNull()
    expect(content?.querySelector('[data-slot="drawer-title"]')?.textContent).toContain(
      'Track points',
    )
    expect(content?.textContent).toContain('2026-11-16 · 2 points')

    const rows = trackRows()
    expect(rows).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('08:35:12')
    expect(rows[0]?.textContent).toContain('116.39700, 39.90800')
    expect(rows[1]?.textContent).toContain('09:12:45')
    expect(rows[1]?.textContent).toContain('116.40000, 39.91000')
  })

  it('marks only the selected row as current', async () => {
    const { open } = mountDrawer({ points, selectedIndex: 1 })

    await openDrawer(open)

    const rows = trackRows()
    expect(rows[0]?.getAttribute('aria-current')).toBeNull()
    expect(rows[1]?.getAttribute('aria-current')).toBe('true')
  })

  it('emits select with the pressed row index', async () => {
    const { open, selections } = mountDrawer({ points })

    await openDrawer(open)
    trackRows()[1]?.click()
    await nextTick()

    expect(selections).toEqual([1])
  })

  it('shows the empty state when the day has no points', async () => {
    const { open } = mountDrawer({ points: [] })

    await openDrawer(open)

    expect(trackRows()).toHaveLength(0)
    const status = drawerContent()?.querySelector('[role="status"]')
    expect(status?.textContent).toContain('No track records')
  })

  it('closes from the close button', async () => {
    const { open } = mountDrawer({ points })
    await openDrawer(open)

    const close = drawerContent()?.querySelector<HTMLButtonElement>('[data-slot="drawer-close"]')
    expect(close?.getAttribute('aria-label')).toBe('Close')
    close?.click()
    await flush()

    expect(open.value).toBe(false)
    expect(drawerContent()).toBeNull()
  })

  it('scrolls the selected row into view when opened', async () => {
    const { open } = mountDrawer({ points, selectedIndex: 1 })

    await openDrawer(open)

    const rows = trackRows()
    expect(rows).toHaveLength(2)
    expect(scrollCalls).toContain(rows[1])
    expect(scrollCalls).not.toContain(rows[0])
  })

  it('scrolls the last row into view when nothing is selected', async () => {
    const { open } = mountDrawer({ points })

    await openDrawer(open)

    const rows = trackRows()
    expect(scrollCalls).toContain(rows[1])
  })
})
