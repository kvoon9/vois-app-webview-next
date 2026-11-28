// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { createApp, h } from 'vue'
import { createI18n } from 'vue-i18n'
import DeviceListItem from './DeviceListItem.vue'

function createTestI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: { device: { online: 'Online', offline: 'Offline', battery: 'Battery' } },
    },
  })
}

let active: { app: ReturnType<typeof createApp>; host: HTMLElement } | null = null

afterEach(() => {
  active?.app.unmount()
  active?.host.remove()
  active = null
})

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 30))

function mountItem(props: { name: string; online: boolean }): void {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({ render: () => h(DeviceListItem, props) })
  app.use(createTestI18n())
  app.mount(host)
  active = { app, host }
}

function rowButton(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>('li > button')
  if (!button) throw new Error('row button is missing')
  return button
}

describe('DeviceListItem', () => {
  it('labels an online device and fills its row online', async () => {
    mountItem({ name: 'Watch', online: true })
    await flush()

    expect(rowButton().textContent).toContain('Online')
    expect(rowButton().classList.contains('border-status-online')).toBe(true)
    expect(rowButton().classList.contains('border-status-offline')).toBe(false)
    expect(rowButton().classList.contains('bg-surface-online')).toBe(true)
    expect(rowButton().classList.contains('bg-surface-muted')).toBe(false)
  })

  it('labels an offline device and fills its row offline', async () => {
    mountItem({ name: 'Watch', online: false })
    await flush()

    expect(rowButton().textContent).toContain('Offline')
    expect(rowButton().classList.contains('border-status-offline')).toBe(true)
    expect(rowButton().classList.contains('border-status-online')).toBe(false)
    expect(rowButton().classList.contains('bg-surface-muted')).toBe(true)
    expect(rowButton().classList.contains('bg-surface-online')).toBe(false)
  })
})
