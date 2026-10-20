<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { useToast } from '~/composables/useToast'
import { getDeviceTrackMode, setDeviceTrackMode, type TrackFrequency } from '~/utils/device-api'

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

const deviceId = computed(() => parseRouteParamId(route.params.id))
const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'device', 'track-mode', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return getDeviceTrackMode(deviceId.value)
  },
})

watch(
  () => state.value.data,
  (value) => {
    if (value) frequency.value = value
  },
  { immediate: true },
)

const { mutateAsync: saveFrequency, isLoading: saving } = useMutation({
  mutation: (value: TrackFrequency) => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return setDeviceTrackMode(deviceId.value, value)
  },
})

async function choose(next: TrackFrequency): Promise<void> {
  if (saving.value || next === frequency.value) return
  const previous = frequency.value
  frequency.value = next
  try {
    await saveFrequency(next)
    await queryCache.invalidateQueries({ key: ['device-management', 'device', 'track-mode'] })
    showToast(t('device.trackSettingUpdated'))
  } catch (error) {
    frequency.value = previous
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('device.trackSetting')" />
    <main class="p-4">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <!-- One panel, four rows, the dot on the right: native's single-group
             radio list. The divider native draws stays out (no borders). -->
        <div
          v-if="state.data !== undefined"
          class="panel overflow-hidden"
          role="radiogroup"
          :aria-label="t('device.trackSetting')"
        >
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            class="panel-row min-h-16 w-full text-left disabled:opacity-60"
            :aria-checked="frequency === option.value"
            role="radio"
            :disabled="saving"
            @click="choose(option.value)"
          >
            <span class="text-header">{{ t(option.label) }}</span>
            <span
              class="radio"
              :class="frequency === option.value ? 'radio-on' : 'radio-off'"
              aria-hidden="true"
            />
          </button>
        </div>
      </QueryState>
    </main>
  </div>
</template>
