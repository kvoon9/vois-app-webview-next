<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { Time } from '@internationalized/date'
import {
  SelectContent,
  SelectItem,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  TimeFieldInput,
  TimeFieldRoot,
  type AcceptableValue,
} from 'reka-ui'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import {
  createDeviceReminder,
  getDeviceReminders,
  removeDeviceReminder,
  updateDeviceReminder,
  type ReminderRepeat,
} from '~/utils/device-api'

type RouteParam = string | string[] | undefined

function routeNumber(value: RouteParam): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.trim() === '') return null
  const number = Number(raw)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

const RING_DURATIONS = [30, 60, 120, 180, 300, 600]
const REPEAT_COUNTS = [0, 1, 2, 3, 5, 10]
const REPEAT_INTERVALS = [1, 2, 3, 5, 10]
const REPEATS: ReminderRepeat[] = ['once', 'daily', 'weekdays']

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const queryCache = useQueryCache()
const { showToast } = useToast()
const deviceId = computed(() => routeNumber(route.params.id))
const reminderId = computed(() => routeNumber(route.params.reminderId))
const isEdit = computed(() => reminderId.value != null)
const editingContent = shallowRef(false)
const contentDraft = shallowRef('')
const deleteConfirmation = shallowRef(false)

function currentTime(): Time {
  const now = new Date()
  return new Time(now.getHours(), now.getMinutes())
}

const time = shallowRef<Time | undefined>(currentTime())
const content = shallowRef('')
const repeat = shallowRef<ReminderRepeat>('once')
const ringDuration = shallowRef(30)
const repeatCount = shallowRef(3)
const repeatInterval = shallowRef(5)

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'reminders', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return getDeviceReminders(deviceId.value)
  },
})

watch(
  () => state.value.data,
  (reminders) => {
    if (!isEdit.value || !reminders) return
    const reminder = reminders.find((item) => item.reminderId === reminderId.value)
    if (!reminder) return
    const [hours, minutes] = reminder.time.split(':').map(Number)
    time.value = new Time(hours, minutes)
    content.value = reminder.content
    repeat.value = reminder.repeat
    ringDuration.value = reminder.ringDuration
    repeatCount.value = reminder.repeatCount
    repeatInterval.value = reminder.repeatInterval
  },
  { immediate: true },
)

const saveMutation = useMutation({
  mutation: () => {
    if (time.value == null) throw new Error(t('device.invalidReminder'))
    const payload = {
      time: time.value.toString().slice(0, 5),
      content: content.value,
      repeat: repeat.value,
      ringDuration: ringDuration.value,
      repeatCount: repeatCount.value,
      repeatInterval: repeatInterval.value,
    }
    if (isEdit.value) {
      if (reminderId.value == null) throw new Error(t('device.invalidReminder'))
      return updateDeviceReminder(reminderId.value, payload)
    }
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return createDeviceReminder(deviceId.value, payload)
  },
})

const removeMutation = useMutation({
  mutation: () => {
    if (reminderId.value == null) throw new Error(t('device.invalidReminder'))
    return removeDeviceReminder(reminderId.value)
  },
})

async function backToList(): Promise<void> {
  await router.push({ path: `/devices/${deviceId.value}/reminders`, query: route.query })
}

async function save(): Promise<void> {
  if (saveMutation.isLoading.value) return
  try {
    await saveMutation.mutateAsync()
    await queryCache.invalidateQueries({ key: ['device-management', 'reminders'] })
    showToast(t('device.reminderSaved'))
    await backToList()
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

async function removeReminder(): Promise<void> {
  if (removeMutation.isLoading.value) return
  try {
    await removeMutation.mutateAsync()
    await queryCache.invalidateQueries({ key: ['device-management', 'reminders'] })
    showToast(t('device.reminderRemoved'))
    await backToList()
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

function openContentEditor(): void {
  contentDraft.value = content.value
  editingContent.value = true
}

function saveContent(): void {
  content.value = contentDraft.value
  editingContent.value = false
}

function repeatText(value: ReminderRepeat): string {
  if (value === 'daily') return t('device.reminderDaily')
  if (value === 'weekdays') return t('device.reminderWeekdays')
  return t('device.reminderOnce')
}

function durationLabel(seconds: number): string {
  if (seconds < 60) return t('device.reminderSeconds', { n: seconds })
  return t('device.reminderMinutes', { n: seconds / 60 })
}

function timesLabel(count: number): string {
  return t('device.reminderTimes', { n: count })
}

/** reka's dayPeriod segment only holds AM/PM internally; display localized text. */
function dayPeriodText(value: string): string {
  return value.startsWith('P') ? t('device.reminderPM') : t('device.reminderAM')
}

const headerTitle = computed(() =>
  isEdit.value ? t('device.reminderEdit') : t('device.reminderNew'),
)

interface SelectRow {
  label: string
  value: string | number
  display: string
  options: Array<{ value: string | number; text: string }>
  apply: (raw: AcceptableValue) => void
}

/** Build one select row; apply only accepts values from the option list. */
function selectRow<T extends string | number>(args: {
  label: string
  value: T
  options: readonly T[]
  text: (value: T) => string
  apply: (value: T) => void
}): SelectRow {
  return {
    label: args.label,
    value: args.value,
    display: args.text(args.value),
    options: args.options.map((value) => ({ value, text: args.text(value) })),
    apply: (raw) => {
      const match = args.options.find((option) => option === raw)
      if (match !== undefined) args.apply(match)
    },
  }
}

const selectRows = computed<SelectRow[]>(() => [
  selectRow<ReminderRepeat>({
    label: t('device.reminderRepeat'),
    value: repeat.value,
    options: REPEATS,
    text: repeatText,
    apply: (value) => {
      repeat.value = value
    },
  }),
  selectRow<number>({
    label: t('device.reminderRingDuration'),
    value: ringDuration.value,
    options: RING_DURATIONS,
    text: durationLabel,
    apply: (value) => {
      ringDuration.value = value
    },
  }),
  selectRow<number>({
    label: t('device.reminderRepeatCount'),
    value: repeatCount.value,
    options: REPEAT_COUNTS,
    text: timesLabel,
    apply: (value) => {
      repeatCount.value = value
    },
  }),
  selectRow<number>({
    label: t('device.reminderRepeatInterval'),
    value: repeatInterval.value,
    options: REPEAT_INTERVALS,
    text: (value) => t('device.reminderMinutes', { n: value }),
    apply: (value) => {
      repeatInterval.value = value
    },
  }),
])
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="headerTitle">
      <template #action>
        <button
          type="button"
          class="absolute right-4 top-1/2 -translate-y-1/2 text-header font-medium text-primary disabled:opacity-50"
          :disabled="saveMutation.isLoading.value"
          @click="save"
        >
          {{ saveMutation.isLoading.value ? t('device.saving') : t('modal.ok') }}
        </button>
      </template>
    </PageHeader>

    <main class="p-4">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <section class="card flex items-center justify-center py-8">
          <TimeFieldRoot
            v-model="time"
            v-slot="{ segments }"
            granularity="minute"
            :hour-cycle="12"
            locale="en"
            class="flex items-center space-x-2 text-title"
          >
            <template v-for="segment in segments" :key="segment.part">
              <TimeFieldInput
                v-if="segment.part !== 'literal'"
                :part="segment.part"
                class="rounded-small px-1 tabular-nums outline-none focus:bg-surface-selected"
              >
                {{ segment.part === 'dayPeriod' ? dayPeriodText(segment.value) : segment.value }}
              </TimeFieldInput>
              <span v-else class="px-0.5 text-text-secondary">{{ segment.value }}</span>
            </template>
          </TimeFieldRoot>
        </section>

        <button
          type="button"
          class="min-h-14 mt-4 w-full flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
          @click="openContentEditor"
        >
          <span>{{ t('device.reminderContent') }}</span>
          <span class="ml-3 min-w-0 flex items-center text-text-secondary">
            <span class="truncate">{{ content || t('device.notAvailable') }}</span>
            <span aria-hidden="true" class="ml-2">›</span>
          </span>
        </button>

        <div class="mt-3 space-y-3">
          <SelectRoot
            v-for="row in selectRows"
            :key="row.label"
            :model-value="row.value"
            @update:model-value="row.apply"
          >
            <SelectTrigger
              class="min-h-14 w-full flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
              :aria-label="row.label"
            >
              <span>{{ row.label }}</span>
              <span class="ml-3 flex items-center text-text-secondary">
                <SelectValue>{{ row.display }}</SelectValue>
                <span aria-hidden="true" class="ml-2">›</span>
              </span>
            </SelectTrigger>
            <SelectPortal>
              <SelectContent
                position="popper"
                :side-offset="4"
                class="z-modal rounded-standard border border-stroke bg-surface shadow-lg"
              >
                <SelectItem
                  v-for="option in row.options"
                  :key="option.value"
                  :value="option.value"
                  class="min-h-12 cursor-pointer px-4 outline-none data-[highlighted]:bg-surface-selected"
                >
                  {{ option.text }}
                </SelectItem>
              </SelectContent>
            </SelectPortal>
          </SelectRoot>
        </div>

        <button
          v-if="isEdit"
          type="button"
          class="mt-8 w-full rounded-button border border-danger px-4 py-3 text-body text-danger disabled:opacity-50"
          :disabled="removeMutation.isLoading.value"
          @click="deleteConfirmation = true"
        >
          {{ t('device.reminderDelete') }}
        </button>
      </QueryState>
    </main>

    <BaseModal
      v-if="editingContent"
      :title="t('device.reminderContent')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="t('modal.confirm')"
      @cancel="editingContent = false"
      @confirm="saveContent"
    >
      <label class="block text-body" for="reminder-content">
        {{ t('device.reminderContent') }}
        <input
          id="reminder-content"
          v-model="contentDraft"
          class="input-field mt-2"
          type="text"
          maxlength="64"
          :placeholder="t('device.reminderContentPlaceholder')"
          @keyup.enter="saveContent"
        />
      </label>
    </BaseModal>

    <BaseModal
      v-if="deleteConfirmation"
      :title="t('device.reminderDelete')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="removeMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!removeMutation.isLoading.value"
      @cancel="deleteConfirmation = false"
      @confirm="removeReminder"
    >
      <p>{{ t('device.reminderDeleteConfirm') }}</p>
    </BaseModal>
  </div>
</template>
