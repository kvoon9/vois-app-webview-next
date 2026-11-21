// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { createApp, h, nextTick, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import LanguagePickerDrawer from './LanguagePickerDrawer.vue'

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
        translation: {
          chooseLanguageDescription: 'Search for and select a language.',
          searchLanguages: 'Search languages…',
          noLanguagesFound: 'No languages found.',
        },
      },
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

function mountPicker(props: {
  disabled?: boolean
  label: string
  languages: string[]
  title: string
}) {
  const model = shallowRef('en')
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () =>
      h(LanguagePickerDrawer, {
        ...props,
        modelValue: model.value,
        'onUpdate:modelValue': (value: string) => {
          model.value = value
        },
      }),
  })
  app.use(createTestI18n())
  app.mount(host)
  active = { app, host }
  return { model }
}

function triggerButton(): HTMLButtonElement {
  const trigger = document.querySelector<HTMLButtonElement>('[data-slot="drawer-trigger"]')
  if (!trigger) throw new Error('drawer trigger is missing')
  return trigger
}

function drawerContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="drawer-content"]')
}

function optionButtons(): HTMLButtonElement[] {
  const content = drawerContent()
  if (!content) return []
  return Array.from(content.querySelectorAll<HTMLButtonElement>('li > button'))
}

function searchInput(): HTMLInputElement {
  const input = drawerContent()?.querySelector<HTMLInputElement>(
    'input[name="translation-language-search"]',
  )
  if (!input) throw new Error('language search input is missing')
  return input
}

async function openDrawer(): Promise<void> {
  triggerButton().click()
  await flush()
}

function typeQuery(value: string): void {
  const input = searchInput()
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const languages = ['en', 'zh-CN', 'fr']

describe('LanguagePickerDrawer', () => {
  it('opens with the full list and an empty query', async () => {
    mountPicker({ label: 'Source', languages, title: 'Translate from' })

    await openDrawer()

    expect(drawerContent()).not.toBeNull()
    expect(optionButtons()).toHaveLength(3)
    expect(searchInput().value).toBe('')
    expect(optionButtons()[0]?.getAttribute('aria-pressed')).toBe('true')
  })

  it('filters the list and shows the empty state when nothing matches', async () => {
    mountPicker({ label: 'Source', languages, title: 'Translate from' })
    await openDrawer()

    typeQuery('zzz')
    await nextTick()

    expect(optionButtons()).toHaveLength(0)
    expect(document.querySelector('[role="status"]')?.textContent).toContain('No languages found.')

    typeQuery('fr')
    await nextTick()

    expect(optionButtons()).toHaveLength(1)
    expect(optionButtons()[0]?.getAttribute('aria-pressed')).toBe('false')
  })

  it('updates the model on selection and clears the query when reopened', async () => {
    const { model } = mountPicker({ label: 'Source', languages, title: 'Translate from' })
    await openDrawer()

    typeQuery('fr')
    await nextTick()
    optionButtons()[0]?.click()
    await flush()

    expect(model.value).toBe('fr')
    expect(drawerContent()).toBeNull()

    await openDrawer()

    expect(searchInput().value).toBe('')
    expect(optionButtons()).toHaveLength(3)
    expect(optionButtons()[2]?.getAttribute('aria-pressed')).toBe('true')
  })

  it('closes from the close button', async () => {
    mountPicker({ label: 'Source', languages, title: 'Translate from' })
    await openDrawer()

    const close = document.querySelector<HTMLButtonElement>('[data-slot="drawer-close"]')
    expect(close?.getAttribute('aria-label')).toBe('Close')
    close?.click()
    await flush()

    expect(drawerContent()).toBeNull()
  })

  it('keeps a disabled trigger closed', async () => {
    const { model } = mountPicker({
      disabled: true,
      label: 'Source',
      languages,
      title: 'Translate from',
    })
    const trigger = triggerButton()

    expect(trigger.disabled).toBe(true)
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await flush()

    expect(drawerContent()).toBeNull()
    expect(model.value).toBe('en')
  })
})
