<script setup lang="ts">
import {
  Calendar,
  CalendarDay,
  CalendarGrid,
  CalendarHeading,
  CalendarNext,
  CalendarPrevious,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
  type CalendarValue,
} from '@ui-sdk/vue/calendar'
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from '@ui-sdk/vue/dialog'
import { shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  open: boolean
  value: string
}>()

const emit = defineEmits<{
  cancel: []
  confirm: [date: string]
}>()

const { locale, t } = useI18n({ useScope: 'global' })
const selectedDate = shallowRef(props.value)
const maxDate = shallowRef(localISODate())

watch(
  () => [props.open, props.value] as const,
  ([isOpen, value]) => {
    if (!isOpen) return
    selectedDate.value = value
    maxDate.value = localISODate()
  },
)

function localISODate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function handleOpenChange(isOpen: boolean): void {
  if (!isOpen) emit('cancel')
}

function handleValueChange(value: CalendarValue): void {
  if (value !== null && !Array.isArray(value)) selectedDate.value = value
}

function confirm(): void {
  emit('confirm', selectedDate.value)
}
</script>

<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogBackdrop class="fixed inset-0 bg-black/50" />

    <DialogContent
      class="fixed top-auto right-auto bottom-0 left-1/2 m-0 h-fit w-full max-w-sm -translate-x-1/2 flex flex-col overflow-y-auto rounded-t-[28px] bg-surface-dialog px-5 pb-5 pt-7 text-text-primary shadow-xl max-h-[calc(100vh-2rem)]"
    >
      <DialogTitle class="text-center text-subtitle font-semibold">
        {{ t('device.selectDate') }}
      </DialogTitle>

      <Calendar
        class="mt-7"
        :value="selectedDate"
        :locale="locale"
        :fixed-weeks="true"
        :unavailable="{ after: maxDate }"
        @value-change="handleValueChange"
      >
        <div class="flex items-center justify-between px-2">
          <CalendarPrevious
            class="h-10 w-10 flex items-center justify-center rounded-full text-2xl text-text-primary hover:bg-surface-muted data-[disabled]:opacity-40"
          >
            <span class="i-ph-caret-left" aria-hidden="true" />
          </CalendarPrevious>
          <CalendarHeading class="text-header font-medium" />
          <CalendarNext
            class="h-10 w-10 flex items-center justify-center rounded-full text-2xl text-text-primary hover:bg-surface-muted data-[disabled]:opacity-40"
          >
            <span class="i-ph-caret-right" aria-hidden="true" />
          </CalendarNext>
        </div>

        <CalendarGrid class="mt-4 w-full border-collapse">
          <CalendarWeekdays v-slot="{ index }">
            <CalendarWeekday
              :index="index"
              class="h-9 text-center text-small font-normal text-text-secondary"
            />
          </CalendarWeekdays>
          <CalendarWeeks v-slot="{ cell }">
            <CalendarDay
              :value="cell.date"
              class="track-calendar-day h-11 p-0 text-center text-body"
            />
          </CalendarWeeks>
        </CalendarGrid>
      </Calendar>

      <footer class="mt-7 flex space-x-3">
        <button
          type="button"
          class="h-12 flex-1 rounded-button bg-surface-muted text-header font-medium"
          @click="emit('cancel')"
        >
          {{ t('modal.cancel') }}
        </button>
        <button
          type="button"
          class="h-12 flex-1 rounded-button bg-primary text-header font-medium text-primary-text"
          @click="confirm"
        >
          {{ t('modal.ok') }}
        </button>
      </footer>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* A table cell cannot be the 40px circle itself, so paint it centered behind the label. */
.track-calendar-day {
  background-position: center;
  background-repeat: no-repeat;
  vertical-align: middle;
  transition:
    color 150ms,
    opacity 150ms;
}

.track-calendar-day[data-selected] {
  background-image: radial-gradient(
    circle closest-side,
    var(--color-primary) 98%,
    transparent 100%
  );
  background-size: 2.5rem 2.5rem;
  color: var(--color-primary-text);
}

.track-calendar-day[data-outside],
.track-calendar-day[data-unavailable] {
  color: var(--color-text-secondary);
  opacity: 0.4;
}
</style>
