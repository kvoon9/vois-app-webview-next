// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { createApp, h } from 'vue'
import Avatar from './Avatar.vue'

type AvatarProps = {
  alt?: string
  name: string
  online?: boolean
  showStatus?: boolean
  size?: 'sm' | 'md' | 'profile' | 'lg' | 'xl' | '2xl'
  src?: string | null
  statusLabel?: string
}

let active: { app: ReturnType<typeof createApp>; host: HTMLElement } | null = null

afterEach(() => {
  active?.app.unmount()
  active?.host.remove()
  active = null
})

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 30))

function mountAvatar(props: AvatarProps): void {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({ render: () => h(Avatar, props) })
  app.mount(host)
  active = { app, host }
}

function avatarRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>('[data-slot="avatar"]')
  if (!root) throw new Error('avatar root is missing')
  return root
}

function avatarImage(): HTMLImageElement | null {
  return avatarRoot().querySelector<HTMLImageElement>('img')
}

function statusDot(): HTMLElement | null {
  return avatarRoot().querySelector<HTMLElement>('.status-dot')
}

describe('Avatar', () => {
  it('shows the first letter when there is no image', async () => {
    mountAvatar({ name: 'Alice' })
    await flush()

    expect(avatarRoot().textContent?.trim()).toBe('A')
    expect(avatarImage()).toBeNull()
  })

  it('renders the source and alt on a real image', async () => {
    mountAvatar({ name: 'Alice', alt: 'Alice avatar', src: 'https://example.test/alice.png' })
    await flush()

    expect(avatarImage()?.getAttribute('src')).toBe('https://example.test/alice.png')
    expect(avatarImage()?.getAttribute('alt')).toBe('Alice avatar')
  })

  it('shows the spinner while the image loads, not the initial', async () => {
    mountAvatar({ name: 'Alice', src: 'https://example.test/alice.png' })
    await flush()

    expect(avatarRoot().querySelector('.i-ph-spinner')).not.toBeNull()
    expect(avatarRoot().textContent?.trim()).toBe('')
  })

  it('falls back to the initial when the image fails', async () => {
    mountAvatar({ name: 'Bob', src: 'https://example.test/bob.png' })
    await flush()

    const image = avatarImage()
    if (!image) throw new Error('avatar image is missing')

    image.dispatchEvent(new Event('load'))
    await flush()
    expect(avatarRoot().textContent?.trim()).toBe('')

    image.dispatchEvent(new Event('error'))
    await flush()
    expect(avatarRoot().textContent?.trim()).toBe('B')
  })

  it('leaves out the status dot unless the status is shown', async () => {
    mountAvatar({ name: 'Alice', online: true })
    await flush()

    expect(statusDot()).toBeNull()
  })

  it('leaves out the status dot when online is undefined', async () => {
    mountAvatar({ name: 'Alice', showStatus: true })
    await flush()

    expect(statusDot()).toBeNull()
  })

  it('paints the online dot blue with its label', async () => {
    mountAvatar({ name: 'Alice', online: true, showStatus: true, statusLabel: 'Online' })
    await flush()

    const dot = statusDot()
    expect(dot?.classList.contains('bg-blue-500')).toBe(true)
    expect(dot?.getAttribute('aria-label')).toBe('Online')
    expect(dot?.getAttribute('role')).toBe('img')
  })

  it('paints the offline dot with the fill colour', async () => {
    mountAvatar({ name: 'Alice', online: false, showStatus: true })
    await flush()

    const dot = statusDot()
    expect(dot?.classList.contains('bg-fill')).toBe(true)
    expect(dot?.classList.contains('bg-blue-500')).toBe(false)
  })

  it('maps the small size to the root classes', async () => {
    mountAvatar({ name: 'Alice', size: 'sm' })
    await flush()

    expect(avatarRoot().classList.contains('h-8')).toBe(true)
    expect(avatarRoot().classList.contains('w-8')).toBe(true)
    expect(avatarRoot().classList.contains('text-2nd-body')).toBe(true)
  })

  it('maps the largest size to the root classes', async () => {
    mountAvatar({ name: 'Alice', size: '2xl' })
    await flush()

    expect(avatarRoot().classList.contains('h-24')).toBe(true)
    expect(avatarRoot().classList.contains('w-24')).toBe(true)
    expect(avatarRoot().classList.contains('text-3xl')).toBe(true)
  })
})
