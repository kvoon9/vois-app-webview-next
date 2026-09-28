<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElementSize, useObjectUrl } from '@vueuse/core'
import BaseModal from '~/components/BaseModal.vue'
import {
  clampCrop,
  coverScale,
  cropToJpeg,
  type CropSource,
  type CropState,
} from '~/utils/crop-image'

const props = withDefaults(
  defineProps<{
    file: File
    outputSize?: number
  }>(),
  { outputSize: 512 },
)

const emit = defineEmits<{
  cancel: []
  confirm: [blob: Blob]
  failed: []
}>()

/** Zoom ceiling; past this the picked square is a handful of source pixels. */
const MAX_ZOOM = 8

const { t } = useI18n({ useScope: 'global' })
const frameEl = useTemplateRef<HTMLDivElement>('frameEl')
const imageEl = useTemplateRef<HTMLImageElement>('imageEl')
const { width: frameSize } = useElementSize(frameEl)
const source = shallowRef<CropSource>({ width: 0, height: 0 })
const crop = shallowRef<CropState>({ scale: 1, tx: 0, ty: 0 })
const encoding = shallowRef(false)
const url = useObjectUrl(computed(() => props.file))

/** Cover scale, so the picture fills the frame instead of fitting inside it. */
const cover = computed(() =>
  source.value.width > 0 ? coverScale(source.value, frameSize.value) : 0,
)

const imageStyle = computed(() => {
  const width = source.value.width * cover.value
  const height = source.value.height * cover.value
  return {
    width: `${width}px`,
    height: `${height}px`,
    marginLeft: `${-width / 2}px`,
    marginTop: `${-height / 2}px`,
    transform: `translate3d(${crop.value.tx}px, ${crop.value.ty}px, 0) scale(${crop.value.scale})`,
  }
})

/** Crop state and midpoint at the moment the finger count last changed. */
interface GestureOrigin {
  crop: CropState
  /** Finger distance, 0 while a single finger pans. */
  distance: number
  x: number
  y: number
}

const pointers = new Map<number, { x: number; y: number }>()
let origin: GestureOrigin = { crop: { scale: 1, tx: 0, ty: 0 }, distance: 0, x: 0, y: 0 }

/** Re-read on every finger count change, so lifting one finger of a pinch never jumps. */
function beginGesture(): void {
  const [a, b] = [...pointers.values()]
  if (!a) return
  origin = {
    crop: crop.value,
    distance: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0,
    x: b ? (a.x + b.x) / 2 : a.x,
    y: b ? (a.y + b.y) / 2 : a.y,
  }
}

function onPointerDown(event: PointerEvent): void {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  beginGesture()
  // Captured last: a WebView without pointer capture still pans while inside the frame
  frameEl.value?.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!pointers.has(event.pointerId)) return
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  const [a, b] = [...pointers.values()]
  const frame = frameEl.value
  if (!a || !frame) return

  const x = b ? (a.x + b.x) / 2 : a.x
  const y = b ? (a.y + b.y) / 2 : a.y
  const distance = b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  const zoom =
    origin.distance > 0 && distance > 0
      ? Math.min(Math.max(origin.crop.scale * (distance / origin.distance), 1), MAX_ZOOM)
      : origin.crop.scale

  // Pinching scales about the fingers, keeping the source pixel under them in
  // place; the midpoint drag then pans on top of that.
  const rect = frame.getBoundingClientRect()
  const anchorX = x - (rect.left + rect.width / 2)
  const anchorY = y - (rect.top + rect.height / 2)
  const ratio = zoom / origin.crop.scale
  const tx = anchorX - ratio * (anchorX - origin.crop.tx) + (x - origin.x)
  const ty = anchorY - ratio * (anchorY - origin.crop.ty) + (y - origin.y)

  crop.value = clampCrop({ scale: zoom, tx, ty }, source.value, rect.width)
}

function onPointerUp(event: PointerEvent): void {
  pointers.delete(event.pointerId)
  beginGesture()
}

function onImageLoad(event: Event): void {
  const image = event.currentTarget
  if (!(image instanceof HTMLImageElement)) return
  source.value = { width: image.naturalWidth, height: image.naturalHeight }
}

async function confirmCrop(): Promise<void> {
  const image = imageEl.value
  if (encoding.value || !image || source.value.width === 0) return
  encoding.value = true
  try {
    emit('confirm', await cropToJpeg(image, crop.value, frameSize.value, props.outputSize))
  } catch {
    emit('failed')
  } finally {
    encoding.value = false
  }
}
</script>

<template>
  <BaseModal
    :title="t('device.cropAvatar')"
    :cancel-text="t('modal.cancel')"
    :confirm-text="t('modal.confirm')"
    @cancel="emit('cancel')"
    @confirm="confirmCrop"
  >
    <!-- paddingTop keeps the frame square without relying on aspect-ratio -->
    <div class="relative w-full" :style="{ paddingTop: '100%' }">
      <div
        ref="frameEl"
        class="absolute inset-0 touch-none select-none overflow-hidden rounded-xl bg-black"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <img
          ref="imageEl"
          :src="url"
          alt=""
          class="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
          :style="imageStyle"
          @load="onImageLoad"
          @error="emit('failed')"
        />
        <!-- The circle is what survives the round avatar frame, so the corners read as discarded -->
        <span
          class="pointer-events-none absolute inset-0 rounded-full"
          :style="{
            boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.8), 0 0 0 9999px rgba(0, 0, 0, 0.5)',
          }"
          aria-hidden="true"
        />
      </div>
    </div>
    <p class="mt-3 text-center text-small text-text-secondary">{{ t('device.cropAvatarHint') }}</p>
  </BaseModal>
</template>
