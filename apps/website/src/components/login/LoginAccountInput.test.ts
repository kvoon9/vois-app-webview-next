// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { createApp, h, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import LoginAccountInput from './LoginAccountInput.vue'

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
        login: { chooseAccount: 'Choose a previously signed-in account' },
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

function mountInput(props: { label: string; accounts: string[]; disabled?: boolean }) {
  const model = shallowRef('')
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () =>
      h(LoginAccountInput, {
        label: props.label,
        accounts: props.accounts,
        disabled: props.disabled ?? false,
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

function accountInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input#login-account')
  if (!input) throw new Error('account input is missing')
  return input
}

function chooseTrigger(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-slot="combobox-trigger"]')
}

function accountItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="combobox-item"]'))
}

function typeAccount(value: string): void {
  const input = accountInput()
  input.focus()
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('LoginAccountInput', () => {
  it('keeps the label and input contract', () => {
    mountInput({ label: 'Account', accounts: [] })

    const label = document.querySelector('label[for="login-account"]')
    const input = accountInput()

    expect(label?.textContent).toBe('Account')
    expect(input.id).toBe('login-account')
    expect(input.getAttribute('placeholder')).toBe('Account')
    expect(input.getAttribute('inputmode')).toBe('text')
    expect(input.getAttribute('autocomplete')).toBe('username')
  })

  it('writes typed text to the model', async () => {
    const { model } = mountInput({ label: 'Account', accounts: [] })

    typeAccount('alice')
    await flush()

    expect(model.value).toBe('alice')
    expect(accountInput().value).toBe('alice')
  })

  it('shows the choose trigger only when accounts exist', () => {
    mountInput({ label: 'Account', accounts: [] })
    expect(chooseTrigger()).toBeNull()
  })

  it('labels the choose trigger and renders saved accounts', async () => {
    mountInput({ label: 'Account', accounts: ['alice', 'bob'] })
    const trigger = chooseTrigger()

    expect(trigger?.getAttribute('aria-label')).toBe('Choose a previously signed-in account')

    trigger?.click()
    await flush()

    expect(accountItems().map((item) => item.textContent?.trim())).toEqual(['alice', 'bob'])
  })

  it('keeps every account listed after typing that matches none', async () => {
    mountInput({ label: 'Account', accounts: ['alice', 'bob', 'carol'] })
    chooseTrigger()?.click()
    await flush()

    typeAccount('zzz')
    await flush()

    expect(accountItems()).toHaveLength(3)
    expect(accountItems().map((item) => item.textContent?.trim())).toEqual([
      'alice',
      'bob',
      'carol',
    ])
  })

  it('fills the model and the input when an account is chosen', async () => {
    const { model } = mountInput({ label: 'Account', accounts: ['alice', 'bob'] })
    chooseTrigger()?.click()
    await flush()

    accountItems()[1]?.click()
    await flush()

    expect(model.value).toBe('bob')
    expect(accountInput().value).toBe('bob')
    expect(accountItems()).toHaveLength(0)
  })

  it('refuses typing while disabled', async () => {
    const { model } = mountInput({ label: 'Account', accounts: [], disabled: true })
    const input = accountInput()

    expect(input.disabled).toBe(true)
    input.value = 'alice'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()

    expect(model.value).toBe('')
  })
})
