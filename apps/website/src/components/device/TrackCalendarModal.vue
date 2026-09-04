<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'
import {
  CalendarCell,
  CalendarCellTrigger,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarHeading,
  CalendarHeader,
  CalendarNext,
  CalendarPrev,
  CalendarRoot,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
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
const selectedDate = shallowRef<DateValue>(parseDate(props.value))

watch(
  () => [props.open, props.value] as const,
  ([open, value]) => {
    if (open) selectedDate.value = parseDate(value)
  },
)

function handleOpenChange(open: boolean): void {
  if (!open) emit('cancel')
}

function confirm(): void {
  emit('confirm', selectedDate.value.toString())
}
</script>

<template>
  <DialogRoot :open="open" @update:open="handleOpenChange">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-modal bg-black/50 p-4">
        <DialogContent
          class="absolute bottom-0 left-1/2 max-h-[calc(100svh-2rem)] w-full max-w-sm -translate-x-1/2 overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-5 pt-7 text-text-primary shadow-xl"
          :aria-describedby="undefined"
          @escape-key-down="handleOpenChange(false)"
        >
          <DialogTitle class="text-center text-subtitle font-semibold">
            {{ t('device.selectDate') }}
          </DialogTitle>

          <CalendarRoot
            v-slot="{ grid, weekDays }"
            v-model="selectedDate"
            class="mt-7"
            :locale="locale"
            :fixed-weeks="true"
            :initial-focus="true"
            :prevent-deselect="true"
          >
            <CalendarHeader class="flex items-center justify-between px-2">
              <CalendarPrev
                class="h-10 w-10 flex items-center justify-center rounded-full text-2xl text-text-primary hover:bg-surface-muted disabled:opacity-40"
              >
                ‹
              </CalendarPrev>
              <CalendarHeading class="text-header font-medium" />
              <CalendarNext
                class="h-10 w-10 flex items-center justify-center rounded-full text-2xl text-text-primary hover:bg-surface-muted disabled:opacity-40"
              >
                ›
              </CalendarNext>
            </CalendarHeader>

            <div class="mt-4">
              <CalendarGrid
                v-for="month in grid"
                :key="month.value.toString()"
                class="w-full border-collapse"
              >
                <CalendarGridHead>
                  <CalendarGridRow>
                    <CalendarHeadCell
                      v-for="weekDay in weekDays"
                      :key="weekDay"
                      class="h-9 text-center text-small font-normal text-text-secondary"
                    >
                      {{ weekDay }}
                    </CalendarHeadCell>
                  </CalendarGridRow>
                </CalendarGridHead>
                <CalendarGridBody>
                  <CalendarGridRow v-for="(week, index) in month.rows" :key="index">
                    <CalendarCell
                      v-for="day in week"
                      :key="day.toString()"
                      :date="day"
                      class="h-11 p-0 text-center"
                    >
                      <CalendarCellTrigger
                        :day="day"
                        :month="month.value"
                        as="button"
                        class="h-10 w-10 rounded-full text-body transition-colors"
                      >
                        <template #default="{ dayValue, outsideView, disabled, selected }">
                          <span
                            class="h-10 w-10 flex items-center justify-center rounded-full"
                            :class="[
                              selected ? 'bg-primary text-primary-text' : '',
                              outsideView || disabled ? 'text-text-secondary/40' : '',
                            ]"
                          >
                            {{ dayValue }}
                          </span>
                        </template>
                      </CalendarCellTrigger>
                    </CalendarCell>
                  </CalendarGridRow>
                </CalendarGridBody>
              </CalendarGrid>
            </div>
          </CalendarRoot>

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
              {{ t('modal.confirm') }}
            </button>
          </footer>
        </DialogContent>
      </DialogOverlay>
    </DialogPortal>
  </DialogRoot>
</template>
