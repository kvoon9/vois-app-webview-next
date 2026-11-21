// @vitest-environment jsdom
import { checkPattern } from '@ui-sdk/core/testing'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { createApp, h, shallowRef, type VNodeChild } from 'vue'
import BaseModal from './BaseModal.vue'

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

type ModalProps = {
  cancelText?: string
  confirmText?: string
  dismissible?: boolean
  title?: string
  tone?: 'primary' | 'danger'
}

type ModalSlots = {
  default: () => VNodeChild
  footer?: () => VNodeChild
}

let active: { app: ReturnType<typeof createApp>; host: HTMLElement } | null = null

afterEach(() => {
  active?.app.unmount()
  active?.host.remove()
  active = null
})

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 30))

function mountModal(
  options: { props?: ModalProps; body?: string; footer?: () => VNodeChild } = {},
) {
  const show = shallowRef(true)
  const cancels: number[] = []
  const confirms: number[] = []
  const slots: ModalSlots = {
    default: () => options.body ?? 'This action cannot be undone.',
  }
  if (options.footer) slots.footer = options.footer

  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () =>
      show.value
        ? h(
            BaseModal,
            {
              title: 'Delete device',
              ...options.props,
              onCancel: () => {
                cancels.push(1)
                show.value = false
              },
              onConfirm: () => {
                confirms.push(1)
                show.value = false
              },
            },
            slots,
          )
        : null,
  })
  app.mount(host)
  active = { app, host }
  return { show, cancels, confirms }
}

function dialogContent(): HTMLElement {
  const content = document.querySelector<HTMLElement>('[data-slot="dialog-content"]')
  if (!content) throw new Error('dialog content is missing')
  return content
}

function footerButtons(): HTMLButtonElement[] {
  return Array.from(dialogContent().querySelectorAll<HTMLButtonElement>('footer button'))
}

function buttonLabeled(label: string): HTMLButtonElement {
  const button = footerButtons().find((element) => element.textContent?.trim() === label)
  if (!button) throw new Error(`${label} button is missing`)
  return button
}

function pressEscape(): void {
  dialogContent().dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  )
}

describe('BaseModal', () => {
  it('renders the title and body content', async () => {
    mountModal({ body: 'Nobody will be notified.' })
    await flush()

    expect(dialogContent().querySelector('[data-slot="dialog-title"]')?.textContent).toContain(
      'Delete device',
    )
    expect(dialogContent().textContent).toContain('Nobody will be notified.')
  })

  it('emits confirm from the confirm action', async () => {
    const { cancels, confirms } = mountModal()
    await flush()

    buttonLabeled('Confirm').click()
    await flush()

    expect(confirms).toHaveLength(1)
    expect(cancels).toHaveLength(0)
  })

  it('emits cancel from the cancel action', async () => {
    const { cancels, confirms } = mountModal()
    await flush()

    buttonLabeled('Cancel').click()
    await flush()

    expect(cancels).toHaveLength(1)
    expect(confirms).toHaveLength(0)
  })

  it('paints the confirm action as danger when tone is danger', async () => {
    mountModal({ props: { tone: 'danger' } })
    await flush()

    const confirm = buttonLabeled('Confirm')
    expect(confirm.classList.contains('bg-danger-soft')).toBe(true)
    expect(confirm.classList.contains('text-danger-soft-text')).toBe(true)
    expect(confirm.classList.contains('bg-primary')).toBe(false)
  })

  it('keeps the dialog open on Escape while not dismissible', async () => {
    const { cancels } = mountModal({ props: { dismissible: false } })
    await flush()

    pressEscape()
    await flush()

    expect(cancels).toHaveLength(0)
    expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeNull()
  })

  it('closes on Escape and emits cancel while dismissible', async () => {
    const { cancels } = mountModal()
    await flush()

    pressEscape()
    await flush()

    expect(cancels).toHaveLength(1)
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull()
  })

  it('replaces the default action row with the footer slot', async () => {
    mountModal({
      footer: () => h('button', { type: 'button', class: 'custom-action' }, 'Acknowledge'),
    })
    await flush()

    expect(buttonLabeled('Acknowledge')).toBeTruthy()
    expect(dialogContent().querySelector('.modal-action')).toBeNull()
  })

  it('meets the dialog pattern', async () => {
    // jsdom has no trigger, but the dialog still records the focused element to return focus to.
    const returnFocus = document.createElement('button')
    document.body.append(returnFocus)
    returnFocus.focus()

    mountModal()
    await flush()

    await checkPattern(dialogContent(), 'dialog')
    returnFocus.remove()
  })
})
