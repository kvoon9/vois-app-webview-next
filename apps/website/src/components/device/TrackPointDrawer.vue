<script setup lang="ts">
import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@ui-sdk/vue/drawer'
import { nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatTrackPoint, formatTrackTime, type TrackMapPoint } from '~/utils/track'

const props = defineProps<{
  points: TrackMapPoint[]
  selectedIndex: number | null
  dateLabel: string
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  select: [index: number]
}>()

const { t } = useI18n({ useScope: 'global' })
const viewport = useTemplateRef<HTMLElement>('viewport')

watch(open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  const rows = viewport.value?.querySelectorAll<HTMLElement>('[data-track-row]')
  if (!rows || rows.length === 0) return
  const target = props.selectedIndex == null ? rows[rows.length - 1] : rows[props.selectedIndex]
  target?.scrollIntoView({ block: 'center' })
})
</script>

<template>
  <Drawer v-model:open="open">
    <DrawerBackdrop class="fixed inset-0 bg-black/35" />

    <DrawerContent
      class="track-drawer relative flex flex-col overflow-hidden rounded-t-[20px] bg-surface-elevated text-text-primary shadow-xl"
    >
      <div
        data-slot="grip"
        class="mx-auto mt-2 h-1 w-8 flex-none rounded-full bg-fill"
        aria-hidden="true"
      />

      <header class="flex flex-none items-center px-4 py-2">
        <div class="min-w-0 flex-1">
          <DrawerTitle class="truncate text-header font-semibold">
            {{ t('device.trackPoints') }}
          </DrawerTitle>
          <p class="truncate text-small text-text-secondary">
            {{ dateLabel }} · {{ t('device.trackPointCount', { count: points.length }) }}
          </p>
        </div>
        <DrawerDescription class="sr-only">
          {{ t('device.trackPointListDescription') }}
        </DrawerDescription>
        <DrawerClose
          class="ml-3 h-11 w-11 flex flex-none items-center justify-center rounded-full bg-surface-muted text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40"
          :aria-label="t('modal.close')"
        >
          <span class="i-ph-x" aria-hidden="true" />
        </DrawerClose>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref="viewport">
          <ul v-if="points.length">
            <li v-for="(point, index) in points" :key="`${point.time}-${index}`">
              <button
                type="button"
                data-track-row
                class="min-h-14 w-full flex items-center justify-between px-4 text-left"
                :class="
                  index === selectedIndex
                    ? 'bg-surface-selected'
                    : 'bg-surface active:bg-surface-muted'
                "
                :aria-current="index === selectedIndex ? 'true' : undefined"
                @click="emit('select', index)"
              >
                <span class="text-body">{{ formatTrackTime(point.time) }}</span>
                <span class="text-small text-text-secondary">
                  {{ formatTrackPoint(point) }}
                </span>
              </button>
            </li>
          </ul>
          <p v-else class="px-4 py-10 text-center text-2nd-body text-text-secondary" role="status">
            {{ t('device.noTrackForDate') }}
          </p>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
</template>

<style scoped>
.track-drawer {
  height: 70vh;
  max-height: 620px;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.5rem);
}
</style>
