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
import { parseRouteParamId } from '~/composables/useRouteParamId'
import type { AMapPoint } from '~/composables/useAMap'
import { useToast } from '~/composables/useToast'
import { getDeviceTrack, getRecentTrackPoint, type TrackPoint } from '~/utils/device-api'

/** Fallback center (Shenzhen) while there is no fix and no track point yet. */
const DEFAULT_CENTER: AMapPoint = { lng: 114.0668, lat: 22.6305 }

const WGS84_SEMI_MAJOR = 6378245
const WGS84_ECC_SQUARED = 0.006693421622965943

/** Latitude offset term of the standard WGS-84 to GCJ-02 approximation. */
function transformLat(x: number, y: number): number {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  ret += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3
  ret += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3
  return ret
}

/** Longitude offset term of the same approximation. */
function transformLng(x: number, y: number): number {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  ret += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3
  ret += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3
  return ret
}

/**
 * Approximate WGS-84 to GCJ-02 conversion, precise to a few meters. AMap only
 * draws GCJ-02, so GPS points (coordType 1) are shifted before they go on the
 * map; the error is far below what a track polyline makes visible.
 */
function wgs84ToGcj02(lng: number, lat: number): AMapPoint {
  let dLat = transformLat(lng - 105, lat - 35)
  let dLng = transformLng(lng - 105, lat - 35)
  const radLat = (lat / 180) * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - WGS84_ECC_SQUARED * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat =
    (dLat * 180) / (((WGS84_SEMI_MAJOR * (1 - WGS84_ECC_SQUARED)) / (magic * sqrtMagic)) * Math.PI)
  dLng = (dLng * 180) / ((WGS84_SEMI_MAJOR / sqrtMagic) * Math.cos(radLat) * Math.PI)
  return { lng: lng + dLng, lat: lat + dLat }
}

function toMapPoint(point: TrackPoint): AMapPoint {
  if (point.coordType === 1) return wgs84ToGcj02(point.lng, point.lat)
  return { lng: point.lng, lat: point.lat }
}

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const { showToast } = useToast()
const calendarOpen = shallowRef(false)
const selectedDate = shallowRef(today(getLocalTimeZone()).toString())
const awaitingDate = shallowRef<string | null>(null)

const deviceId = computed(() => parseRouteParamId(route.params.id))
const { state: recentState, refetch: reloadRecent } = useQuery({
  key: () => ['device-management', 'device', 'recent-point', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return getRecentTrackPoint(deviceId.value)
  },
})
const { state: trackState, refetch: reloadTrack } = useQuery({
  key: () => ['device-management', 'device', 'track', deviceId.value, selectedDate.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return getDeviceTrack(deviceId.value, selectedDate.value)
  },
})

const recent = computed(() => {
  const point = recentState.value.data
  return point ? toMapPoint(point) : null
})
const track = computed(() => trackState.value.data?.map(toMapPoint) ?? [])
const center = computed(() => recent.value ?? track.value[0] ?? DEFAULT_CENTER)

watch(
  () => trackState.value.status,
  (status) => {
    if (status !== 'success' || awaitingDate.value !== selectedDate.value) return
    if (track.value.length === 0) showToast(t('device.noTrackForDate'), { type: 'info' })
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

      <QueryState :status="recentState.status" :error="recentState.error" @retry="reloadRecent()">
        <template v-if="recentState.data !== undefined">
          <QueryState :status="trackState.status" :error="trackState.error" @retry="reloadTrack()">
            <MapCanvas :center="center" :marker="recent" :track="track" />
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
