<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElementSize, useMutationObserver, useObjectUrl } from '@vueuse/core'
import { cropImage } from '@ui-sdk/vue/image'
import {
  ImageCropper,
  ImageCropperImage,
  ImageCropperSelection,
  ImageCropperViewport,
  type ImageCrop,
} from '@ui-sdk/vue/image-cropper'
import BaseModal from '~/components/BaseModal.vue'

const props = withDefaults(
  defineProps<{
    file: File
    outputSize?: number
    /**Modal title; the device page crops a device avatar, groups a group avatar.*/
    title?: string
  }>(),
  { outputSize: 512, title: undefined },
)

const emit = defineEmits<{
  cancel: []
  confirm: [blob: Blob]
  failed: []
}>()

/** Zoom ceiling; past this the picked square is a handful of source pixels. */
const MAX_ZOOM = 8

const { t } = useI18n({ useScope: 'global' })
const resolvedTitle = computed(() => props.title ?? t('device.cropAvatar'))
const url = useObjectUrl(computed(() => props.file))
const crop = shallowRef<ImageCrop>()
const encoding = shallowRef(false)
const frameEl = useTemplateRef<HTMLDivElement>('frameEl')
const { width: frameWidth } = useElementSize(frameEl)
/** Height from the measured width squares the viewport; the SDK owns `position`. */
const frameStyle = computed(() => `height:${frameWidth.value}px`)

// The SDK reports a decode failure only as data-error, and the consumers upload
// the original file on `failed`; without this bridge a corrupt file strands the
// modal open. Report once, like the old img @error did.
let reportedFailure = false
useMutationObserver(
  frameEl,
  () => {
    if (reportedFailure || !frameEl.value?.querySelector('[data-error]')) return
    reportedFailure = true
    emit('failed')
  },
  { attributes: true, attributeFilter: ['data-error'], subtree: true },
)

async function confirmCrop(): Promise<void> {
  const current = crop.value
  // One encode at a time; a second tap while it runs would upload twice.
  if (encoding.value || !current) return
  encoding.value = true
  try {
    const file = await cropImage(props.file, current, {
      type: 'image/jpeg',
      quality: 0.85,
      width: props.outputSize,
      height: props.outputSize,
    })
    emit('confirm', file)
  } catch {
    emit('failed')
  } finally {
    encoding.value = false
  }
}
</script>

<template>
  <BaseModal
    :title="resolvedTitle"
    :cancel-text="t('modal.cancel')"
    :confirm-text="t('modal.confirm')"
    @cancel="emit('cancel')"
    @confirm="confirmCrop"
  >
    <div ref="frameEl" class="w-full">
      <ImageCropper
        v-model:crop="crop"
        :src="url"
        mode="frame"
        :aspect-ratio="1"
        :max-zoom="MAX_ZOOM"
        :aria-label="resolvedTitle"
      >
        <ImageCropperViewport
          class="w-full overflow-hidden rounded-xl bg-black"
          :style="frameStyle"
        >
          <ImageCropperImage alt="" />
          <ImageCropperSelection />
          <!-- The circle is what survives the round avatar frame, so the corners read as discarded -->
          <span
            class="pointer-events-none absolute inset-0 rounded-full"
            :style="{
              boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.8), 0 0 0 9999px rgba(0, 0, 0, 0.5)',
            }"
            aria-hidden="true"
          />
        </ImageCropperViewport>
      </ImageCropper>
    </div>
    <p class="mt-3 text-center text-small text-text-secondary">{{ t('device.cropAvatarHint') }}</p>
  </BaseModal>
</template>
