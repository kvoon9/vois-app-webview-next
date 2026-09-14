<script setup lang="ts">
import { getLocalTimeZone, today } from '@internationalized/date'
import { useQuery } from '@pinia/colada'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import MapCanvas from '~/components/device/MapCanvas.vue'
import TrackCalendarModal from '~/components/device/TrackCalendarModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import { getDeviceLocation, getDeviceTrack } from '~/utils/device-api'

type RouteParam = string | string[] | undefined

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const { showToast } = useToast()
const calendarOpen = shallowRef(false)
const selectedDate = shallowRef(today(getLocalTimeZone()).toString())
const awaitingDate = shallowRef<string | null>(null)

function routeNumber(value: RouteParam): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.trim() === '') return null
  const number = Number(raw)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

const deviceId = computed(() => routeNumber(route.params.id))
const { state: locationState, refetch: reloadLocation } = useQuery({
  key: () => ['device-management', 'device', 'location', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return getDeviceLocation(deviceId.value)
  },
})
const { state: trackState, refetch: reloadTrack } = useQuery({
  key: () => ['device-management', 'device', 'track', deviceId.value, selectedDate.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return getDeviceTrack(deviceId.value, selectedDate.value)
  },
})

const location = computed(() => locationState.value.data ?? null)
const points = computed(() => trackState.value.data ?? [])
const center = computed(() => ({
  lng: location.value?.lng ?? points.value[0]?.lng ?? 114.0668,
  lat: location.value?.lat ?? points.value[0]?.lat ?? 22.6305,
}))

watch(
  () => trackState.value.status,
  (status) => {
    if (status !== 'success' || awaitingDate.value !== selectedDate.value) return
    if (points.value.length === 0) showToast(t('device.noTrackForDate'), { type: 'info' })
    awaitingDate.value = null
  },
)

function confirmDate(date: string): void {
  awaitingDate.value = date
  selectedDate.value = date
  calendarOpen.value = false
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('device.trackRecords')" />
    <main class="relative h-[calc(100svh-3.5rem)]">
      <button
        type="button"
        class="absolute right-14 top-2 z-20 h-10 w-10 flex items-center justify-center rounded-small text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        :aria-label="t('device.selectDate')"
        @click="calendarOpen = true"
      >
        <span class="i-ph-calendar-blank text-title" aria-hidden="true" />
      </button>

      <QueryState
        :status="locationState.status"
        :error="locationState.error"
        @retry="reloadLocation()"
      >
        <template v-if="location">
          <QueryState :status="trackState.status" :error="trackState.error" @retry="reloadTrack()">
            <MapCanvas
              :center="center"
              :marker="{ lng: location.lng, lat: location.lat }"
              :track="points"
            />
          </QueryState>
        </template>
      </QueryState>
    </main>

    <TrackCalendarModal
      :open="calendarOpen"
      :value="selectedDate"
      @cancel="calendarOpen = false"
      @confirm="confirmDate"
    />
  </div>
</template>
