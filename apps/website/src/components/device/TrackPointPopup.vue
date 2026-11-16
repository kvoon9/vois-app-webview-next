<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatTrackPoint, formatTrackTime, type TrackMapPoint } from '~/utils/track'

defineProps<{
  point: TrackMapPoint
  index: number
  count: number
  address: string
  addressPending: boolean
}>()

const emit = defineEmits<{
  close: []
  previous: []
  next: []
}>()

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <section
    class="track-point-popup absolute left-4 right-4 z-20 rounded-large bg-surface-elevated p-4 shadow-xl"
    role="region"
    :aria-label="t('device.trackPointAt', { time: formatTrackTime(point.time) })"
  >
    <div class="flex items-center">
      <p class="min-w-0 flex-1 text-small text-text-secondary">
        <span>{{ formatTrackTime(point.time) }}</span>
        <span class="ml-2">{{ index + 1 }}/{{ count }}</span>
      </p>
      <button
        type="button"
        class="h-11 w-11 flex flex-none items-center justify-center rounded-full text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40"
        :aria-label="t('modal.close')"
        @click="emit('close')"
      >
        <span class="i-ph-x text-lg" aria-hidden="true" />
      </button>
    </div>

    <p
      class="min-h-6 break-words text-body font-medium"
      aria-live="polite"
      :aria-busy="addressPending"
    >
      {{ address || formatTrackPoint(point) }}
    </p>

    <div class="mt-3 flex space-x-3">
      <button
        type="button"
        class="h-12 flex-1 flex items-center justify-center rounded-button bg-surface-muted text-2nd-body font-medium disabled:opacity-50"
        :disabled="index === 0"
        @click="emit('previous')"
      >
        <span class="i-ph-caret-left text-lg" aria-hidden="true" />
        <span class="ml-1">{{ t('device.previousPoint') }}</span>
      </button>
      <button
        type="button"
        class="h-12 flex-1 flex items-center justify-center rounded-button bg-surface-muted text-2nd-body font-medium disabled:opacity-50"
        :disabled="index === count - 1"
        @click="emit('next')"
      >
        <span class="ml-1">{{ t('device.nextPoint') }}</span>
        <span class="i-ph-caret-right text-lg" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.track-point-popup {
  bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem);
}
</style>
