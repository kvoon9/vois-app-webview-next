// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createApp, h } from 'vue'
import { createI18n } from 'vue-i18n'
import ImageCropper from './ImageCropper.vue'

const { cropImageMock, CROP } = vi.hoisted(() => ({
  cropImageMock: vi.fn(),
  CROP: { x: 12, y: 8, width: 200, height: 200, rotation: 0, flipX: false, flipY: false },
}))

vi.mock('@ui-sdk/vue/image', () => ({ cropImage: cropImageMock }))

// The real cropper needs layout and image decoding to produce a crop, neither of which jsdom has.
vi.mock('@ui-sdk/vue/image-cropper', async () => {
  const { defineComponent, h, onMounted } = await import('vue')
  const part = (name: string) =>
    defineComponent({
      name,
      setup:
        (_props, { slots }) =>
        () =>
          h('div', slots.default?.()),
    })
  const Cropper = defineComponent({
    name: 'ImageCropper',
    props: { crop: Object },
    emits: ['update:crop'],
    setup: (_props, { emit, slots }) => {
      onMounted(() => emit('update:crop', CROP))
      return () => h('div', { 'data-test': 'cropper' }, slots.default?.())
    },
  })
  return {
    ImageCropper: Cropper,
    ImageCropperImage: part('ImageCropperImage'),
    ImageCropperSelection: part('ImageCropperSelection'),
    ImageCropperViewport: part('ImageCropperViewport'),
  }
})

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

Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:test' })
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} })

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
        device: {
          cropAvatar: 'Crop group avatar',
          cropAvatarHint: 'Drag to reposition, pinch to zoom',
        },
        modal: { cancel: 'Cancel', confirm: 'Confirm' },
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

beforeEach(() => {
  cropImageMock.mockReset()
})

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 30))

function mountCropper(props: { file: File; outputSize?: number; title?: string }) {
  const cancels: number[] = []
  const confirms: Blob[] = []
  const failures: number[] = []
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () =>
      h(ImageCropper, {
        ...props,
        onCancel: () => cancels.push(1),
        onConfirm: (blob: Blob) => confirms.push(blob),
        onFailed: () => failures.push(1),
      }),
  })
  app.use(createTestI18n())
  app.mount(host)
  active = { app, host }
  return { cancels, confirms, failures }
}

function dialogContent(): HTMLElement {
  const content = document.querySelector<HTMLElement>('[data-slot="dialog-content"]')
  if (!content) throw new Error('dialog content is missing')
  return content
}

function buttonLabeled(label: string): HTMLButtonElement {
  const button = Array.from(
    dialogContent().querySelectorAll<HTMLButtonElement>('footer button'),
  ).find((element) => element.textContent?.trim() === label)
  if (!button) throw new Error(`${label} button is missing`)
  return button
}

const avatarFile = () => new File(['avatar'], 'avatar.png', { type: 'image/png' })
const jpegFile = () => new File(['jpeg'], 'avatar.jpeg', { type: 'image/jpeg' })

describe('ImageCropper', () => {
  it('renders the modal chrome with the title from its prop', async () => {
    mountCropper({ file: avatarFile(), title: 'Crop device avatar' })
    await flush()

    const content = dialogContent()
    expect(content.querySelector('[data-slot="dialog-title"]')?.textContent).toContain(
      'Crop device avatar',
    )
    expect(content.textContent).toContain('Drag to reposition, pinch to zoom')
    expect(content.querySelector('[data-test="cropper"]')).not.toBeNull()
  })

  it('falls back to the group-avatar title when no title is passed', async () => {
    mountCropper({ file: avatarFile() })
    await flush()

    expect(dialogContent().querySelector('[data-slot="dialog-title"]')?.textContent).toContain(
      'Crop group avatar',
    )
  })

  it('emits cancel from the cancel action', async () => {
    const { cancels, confirms } = mountCropper({ file: avatarFile() })
    await flush()

    buttonLabeled('Cancel').click()
    await flush()

    expect(cancels).toHaveLength(1)
    expect(confirms).toHaveLength(0)
  })

  it('encodes the crop as a square JPEG at outputSize and emits the File', async () => {
    cropImageMock.mockResolvedValueOnce(jpegFile())
    const file = avatarFile()
    const { cancels, confirms } = mountCropper({ file })
    await flush()

    buttonLabeled('Confirm').click()
    await flush()

    expect(cropImageMock).toHaveBeenCalledWith(file, CROP, {
      type: 'image/jpeg',
      quality: 0.85,
      width: 512,
      height: 512,
    })
    expect(confirms).toHaveLength(1)
    expect(confirms[0]).toBeInstanceOf(Blob)
    expect(confirms[0]?.type).toBe('image/jpeg')
    expect(cancels).toHaveLength(0)
  })

  it('scales the output to a custom outputSize', async () => {
    cropImageMock.mockResolvedValueOnce(jpegFile())
    const file = avatarFile()
    mountCropper({ file, outputSize: 256 })
    await flush()

    buttonLabeled('Confirm').click()
    await flush()

    expect(cropImageMock).toHaveBeenCalledWith(file, CROP, {
      type: 'image/jpeg',
      quality: 0.85,
      width: 256,
      height: 256,
    })
  })

  it('emits failed once when the SDK marks the image as undecodable', async () => {
    const { confirms, failures } = mountCropper({ file: avatarFile() })
    await flush()

    const cropperRoot = document.querySelector('[data-test="cropper"]')
    expect(cropperRoot).not.toBeNull()
    cropperRoot?.setAttribute('data-error', '')
    await flush()

    expect(failures).toHaveLength(1)
    expect(confirms).toHaveLength(0)
  })

  it('emits failed when encoding rejects', async () => {
    cropImageMock.mockRejectedValueOnce(new Error('JPEG encoding failed'))
    const { confirms, failures } = mountCropper({ file: avatarFile() })
    await flush()

    buttonLabeled('Confirm').click()
    await flush()

    expect(failures).toHaveLength(1)
    expect(confirms).toHaveLength(0)
  })

  it('encodes once when confirm is pressed while the first encode runs', async () => {
    let resolve!: (file: File) => void
    cropImageMock.mockReturnValueOnce(
      new Promise<File>((done) => {
        resolve = done
      }),
    )
    const { confirms } = mountCropper({ file: avatarFile() })
    await flush()

    const confirm = buttonLabeled('Confirm')
    confirm.click()
    confirm.click()
    await flush()

    expect(cropImageMock).toHaveBeenCalledTimes(1)
    expect(confirms).toHaveLength(0)

    resolve(jpegFile())
    await flush()

    expect(confirms).toHaveLength(1)
  })
})
