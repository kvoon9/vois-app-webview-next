<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import {
  getDeviceLocation,
  updateDeviceTrackSetting,
  type TrackFrequency,
} from '~/utils/device-api'

type RouteParam = string | string[] | undefined

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const queryCache = useQueryCache()
const { showToast } = useToast()
const frequency = shallowRef<TrackFrequency>('off')

const options: Array<{ value: TrackFrequency; label: string }> = [
  { value: 'off', label: 'device.frequencyOff' },
  { value: 'low', label: 'device.frequencyLow' },
  { value: 'mid', label: 'device.frequencyMid' },
  { value: 'high', label: 'device.frequencyHigh' },
]

function routeNumber(value: RouteParam): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.trim() === '') return null
  const number = Number(raw)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

const deviceId = computed(() => routeNumber(route.params.id))
const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'device', 'location', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return getDeviceLocation(deviceId.value)
  },
})

watch(
  () => state.value.data?.reportFrequency,
  (value) => {
    if (value) frequency.value = value
  },
  { immediate: true },
)

const { mutateAsync: saveFrequency, isLoading: saving } = useMutation({
  mutation: (value: TrackFrequency) => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return updateDeviceTrackSetting(deviceId.value, value)
  },
})

async function choose(next: TrackFrequency): Promise<void> {
  if (saving.value || next === frequency.value) return
  const previous = frequency.value
  frequency.value = next
  try {
    await saveFrequency(next)
    await queryCache.invalidateQueries({ key: ['device-management', 'device', 'location'] })
    showToast(t('device.trackSettingUpdated'))
  } catch (error) {
    frequency.value = previous
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.trackSetting')" />
    <main class="p-4">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <div
          v-if="state.data"
          class="divide-y divide-stroke overflow-hidden rounded-large border border-stroke bg-surface"
          role="radiogroup"
          :aria-label="t('device.trackSetting')"
        >
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            class="min-h-16 w-full flex items-center justify-between px-5 text-left disabled:opacity-60"
            :aria-checked="frequency === option.value"
            role="radio"
            :disabled="saving"
            @click="choose(option.value)"
          >
            <span class="text-header">{{ t(option.label) }}</span>
            <span
              class="h-5 w-5 rounded-full border-2"
              :class="
                frequency === option.value
                  ? 'border-primary bg-primary'
                  : 'border-stroke bg-surface-muted'
              "
              aria-hidden="true"
            />
          </button>
        </div>
      </QueryState>
    </main>
  </div>
</template>
