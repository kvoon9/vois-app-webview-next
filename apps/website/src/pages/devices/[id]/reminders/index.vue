<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { getDeviceReminders } from '~/utils/device-api'

type RouteParam = string | string[] | undefined

function routeNumber(value: RouteParam): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.trim() === '') return null
  const number = Number(raw)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const deviceId = computed(() => routeNumber(route.params.id))

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'reminders', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return getDeviceReminders(deviceId.value)
  },
})

const reminders = computed(() => state.value.data ?? [])

function repeatLabel(repeat: string): string {
  if (repeat === 'daily') return t('device.reminderDaily')
  if (repeat === 'weekdays') return t('device.reminderWeekdays')
  return t('device.reminderOnce')
}

function openNew(): void {
  if (deviceId.value == null) return
  router.push({ path: `/devices/${deviceId.value}/reminders/new`, query: route.query })
}

function openReminder(reminderId: number): void {
  if (deviceId.value == null) return
  router.push({
    path: `/devices/${deviceId.value}/reminders/${reminderId}`,
    query: route.query,
  })
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.reminders')" />

    <main class="p-4 pb-28">
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.status === 'success' && reminders.length === 0"
        :empty-text="t('device.emptyReminders')"
        @retry="reload()"
      >
        <ul class="space-y-3">
          <li v-for="reminder in reminders" :key="reminder.reminderId" class="card">
            <button
              type="button"
              class="w-full text-left"
              @click="openReminder(reminder.reminderId)"
            >
              <span class="block text-title font-semibold">{{ reminder.time }}</span>
              <span class="mt-1 block truncate text-2nd-body">{{ reminder.content }}</span>
              <span class="mt-1 block text-small text-text-secondary">
                {{ repeatLabel(reminder.repeat) }}
              </span>
            </button>
          </li>
        </ul>
      </QueryState>

      <button
        type="button"
        class="fixed bottom-8 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border border-stroke bg-surface text-3xl leading-none text-primary shadow-lg"
        :aria-label="t('device.reminderNew')"
        @click="openNew"
      >
        ＋
      </button>
    </main>
  </div>
</template>
