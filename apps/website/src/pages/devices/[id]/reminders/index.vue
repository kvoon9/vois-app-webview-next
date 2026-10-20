<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { getDeviceReminders } from '~/utils/device-api'
import { reminderRepeatLabel } from '~/utils/reminder-repeat-label'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const deviceId = computed(() => parseRouteParamId(route.params.id))

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'reminders', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return getDeviceReminders(deviceId.value)
  },
})

/** Native sorts by the clock time, not by creation order. */
const reminders = computed(() =>
  [...(state.value.data ?? [])].sort((a, b) => a.time.localeCompare(b.time)),
)

function openNew(): void {
  if (deviceId.value == null) return
  router.push(`/devices/${deviceId.value}/reminders/new`)
}

function openReminder(reminderId: number): void {
  if (deviceId.value == null) return
  router.push(`/devices/${deviceId.value}/reminders/${reminderId}`)
}
</script>

<template>
  <div class="page">
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
              <span class="mt-1 block truncate text-body">{{ reminder.content }}</span>
              <span class="mt-1 block text-2nd-body text-text-secondary">
                {{ reminderRepeatLabel(t, reminder.repeat, reminder.repeatDays) }}
              </span>
            </button>
          </li>
        </ul>
      </QueryState>

      <button
        type="button"
        class="fixed bottom-8 left-1/2 -translate-x-1/2 fab"
        :aria-label="t('device.reminderNew')"
        @click="openNew"
      >
        <span class="i-ph-plus" aria-hidden="true" />
      </button>
    </main>
  </div>
</template>
