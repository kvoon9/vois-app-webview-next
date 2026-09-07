<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
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

function currentTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/** HH:mm (24h), straight from <input type="time">. */
const time = shallowRef(currentTime())
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
    time.value = reminder.time
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
    const payload = {
      time: time.value,
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

interface OptionRow {
  key: 'repeat' | 'ringDuration' | 'repeatCount' | 'repeatInterval'
  label: string
  options: Array<{ value: string | number; text: string }>
  current: () => string | number
  text: (value: string | number) => string
  choose: (value: string | number) => void
}

const optionRows: OptionRow[] = [
  {
    key: 'repeat',
    label: t('device.reminderRepeat'),
    options: REPEATS.map((value) => ({ value, text: repeatText(value) })),
    current: () => repeat.value,
    text: repeatText,
    choose: (value) => {
      const match = REPEATS.find((option) => option === value)
      if (match !== undefined) repeat.value = match
    },
  },
  {
    key: 'ringDuration',
    label: t('device.reminderRingDuration'),
    options: RING_DURATIONS.map((value) => ({ value, text: durationLabel(value) })),
    current: () => ringDuration.value,
    text: durationLabel,
    choose: (value) => {
      const match = RING_DURATIONS.find((option) => option === value)
      if (match !== undefined) ringDuration.value = match
    },
  },
  {
    key: 'repeatCount',
    label: t('device.reminderRepeatCount'),
    options: REPEAT_COUNTS.map((value) => ({ value, text: timesLabel(value) })),
    current: () => repeatCount.value,
    text: timesLabel,
    choose: (value) => {
      const match = REPEAT_COUNTS.find((option) => option === value)
      if (match !== undefined) repeatCount.value = match
    },
  },
  {
    key: 'repeatInterval',
    label: t('device.reminderRepeatInterval'),
    options: REPEAT_INTERVALS.map((value) => ({
      value,
      text: t('device.reminderMinutes', { n: value }),
    })),
    current: () => repeatInterval.value,
    text: (value) => t('device.reminderMinutes', { n: value }),
    choose: (value) => {
      const match = REPEAT_INTERVALS.find((option) => option === value)
      if (match !== undefined) repeatInterval.value = match
    },
  },
]

/** Which option row's picker sheet is open, if any. */
const activeRow = shallowRef<OptionRow | null>(null)

function currentText(row: OptionRow): string {
  const match = row.options.find((option) => option.value === row.current())
  return match ? match.text : t('device.notAvailable')
}

function chooseOption(value: string | number): void {
  if (activeRow.value) activeRow.value.choose(value)
  activeRow.value = null
}

function openContentEditor(): void {
  contentDraft.value = content.value
  editingContent.value = true
}

function saveContent(): void {
  content.value = contentDraft.value
  editingContent.value = false
}

const headerTitle = computed(() =>
  isEdit.value ? t('device.reminderEdit') : t('device.reminderNew'),
)
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
        <section class="card flex items-center justify-center py-6">
          <input
            v-model="time"
            type="time"
            :aria-label="t('device.reminderTime')"
            class="bg-transparent text-title text-text-primary outline-none"
          />
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
          <button
            v-for="row in optionRows"
            :key="row.key"
            type="button"
            class="min-h-14 w-full flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
            @click="activeRow = row"
          >
            <span>{{ row.label }}</span>
            <span class="ml-3 min-w-0 flex items-center text-text-secondary">
              <span class="truncate">{{ currentText(row) }}</span>
              <span aria-hidden="true" class="ml-2">›</span>
            </span>
          </button>
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
      v-if="activeRow"
      :title="activeRow.label"
      :cancel-text="t('modal.close')"
      @cancel="activeRow = null"
    >
      <template #footer>
        <button
          type="button"
          class="min-h-10 w-full rounded-small bg-surface-muted px-4 text-body text-text-primary"
          @click="activeRow = null"
        >
          {{ t('modal.close') }}
        </button>
      </template>
      <div class="divide-y divide-stroke" role="radiogroup" :aria-label="activeRow.label">
        <button
          v-for="option in activeRow.options"
          :key="option.value"
          type="button"
          role="radio"
          class="min-h-14 w-full flex items-center justify-between px-1 text-left"
          :aria-checked="option.value === activeRow?.current()"
          @click="chooseOption(option.value)"
        >
          <span class="text-body">{{ option.text }}</span>
          <span
            class="h-5 w-5 flex-none rounded-full border-2"
            :class="
              option.value === activeRow?.current()
                ? 'border-primary bg-primary'
                : 'border-stroke bg-surface-muted'
            "
            aria-hidden="true"
          />
        </button>
      </div>
    </BaseModal>

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
