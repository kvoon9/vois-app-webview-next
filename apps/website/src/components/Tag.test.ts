// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { createApp, h } from 'vue'
import Tag from './Tag.vue'

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

let active: { app: ReturnType<typeof createApp>; host: HTMLElement } | null = null

afterEach(() => {
  active?.app.unmount()
  active?.host.remove()
  active = null
})

function mountTag(tone?: Tone): HTMLSpanElement {
  const host = document.createElement('div')
  document.body.append(host)
  const props = tone ? { label: 'Paid', tone } : { label: 'Paid' }
  const app = createApp({ render: () => h(Tag, props) })
  app.mount(host)
  active = { app, host }
  const tag = host.querySelector('span')
  if (!tag) throw new Error('tag is missing')
  return tag
}

describe('Tag', () => {
  it('renders the label on the neutral fill by default', () => {
    const tag = mountTag()

    expect(tag.textContent).toContain('Paid')
    expect(tag.classList.contains('text-2nd-body')).toBe(true)
    expect(tag.classList.contains('bg-surface-muted')).toBe(true)
    expect(tag.classList.contains('text-text-secondary')).toBe(true)
  })

  it('uses the success pair for a settled state', () => {
    const tag = mountTag('success')

    expect(tag.classList.contains('bg-surface-online')).toBe(true)
    expect(tag.classList.contains('text-status-online')).toBe(true)
  })

  it('uses the warning pair for a pending state', () => {
    const tag = mountTag('warning')

    expect(tag.classList.contains('bg-[var(--color-warning-soft)]')).toBe(true)
    expect(tag.classList.contains('text-[var(--color-warning-soft-text)]')).toBe(true)
  })

  it('uses the danger pair for a failed state', () => {
    const tag = mountTag('danger')

    expect(tag.classList.contains('bg-danger-soft')).toBe(true)
    expect(tag.classList.contains('text-danger-soft-text')).toBe(true)
  })
})
