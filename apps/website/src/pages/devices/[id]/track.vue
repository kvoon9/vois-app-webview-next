<script setup lang="ts">
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { useQuery } from '@pinia/colada'
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import MapCanvas from '~/components/device/MapCanvas.vue'
import TrackCalendarModal from '~/components/device/TrackCalendarModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import type { AMapPoint } from '~/composables/useAMap'
import {
  getDeviceDetail,
  getDeviceTrack,
  getRecentTrackPoint,
  type TrackPoint,
} from '~/utils/device-api'

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
/** Native opens the date picker as the page appears, today preselected. */
const calendarOpen = shallowRef(true)
const selectedDate = shallowRef(today(getLocalTimeZone()).toString())
const awaitingDate = shallowRef<string | null>(null)
/** The date pill only appears once a day has actually been confirmed. */
const dateConfirmed = shallowRef(false)

const deviceId = computed(() => parseRouteParamId(route.params.id))

/** Same key as the device-detail page, so the avatar pin shares its cache. */
const { state: deviceState } = useQuery({
  key: () => ['device-management', 'device', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return getDeviceDetail(deviceId.value)
  },
})
const device = computed(() => deviceState.value.data ?? null)

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
const track = computed(() => filterJumps(trackState.value.data ?? []).map(toMapPoint))

/** The date the map shows, as native's `M/d` tag. */
const dateLabel = computed(() => {
  const date = parseDate(selectedDate.value)
  return `${date.month}/${date.day}`
})

/** Great-circle distance in meters; the track comes in one coordinate system. */
function distance(a: TrackPoint, b: TrackPoint): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

function timeOf(point: TrackPoint): number {
  return Date.parse(point.time.replace(' ', 'T'))
}

function speed(a: TrackPoint, b: TrackPoint): number {
  const seconds = (timeOf(b) - timeOf(a)) / 1000
  return seconds > 0 ? distance(a, b) / seconds : 0
}

/**
 * Drop isolated GPS spikes the way native does: a dot flies away and comes
 * straight back. A point is a spike when both hops exceed 100 m/s while its
 * neighbours are close to each other; real movement keeps the point.
 */
function filterJumps(points: TrackPoint[]): TrackPoint[] {
  if (points.length < 3) return points
  const kept: TrackPoint[] = []
  for (let i = 0; i < points.length; i++) {
    const point = points[i]!
    const previous = points[i - 1]
    const next = points[i + 1]
    if (previous && next) {
      const inSpeed = speed(previous, point)
      const outSpeed = speed(point, next)
      const skipSpeed = speed(previous, next)
      if (inSpeed > 100 && outSpeed > 100 && skipSpeed <= 100) continue
    }
    kept.push(point)
  }
  return kept
}
const center = computed(() => recent.value ?? track.value[0] ?? DEFAULT_CENTER)

/**
 * An empty day reports through the bottom toast native uses, which times out on
 * its own: the map stays bare afterwards instead of holding a floating pill.
 */
const emptyToast = shallowRef(false)
let emptyToastTimer: ReturnType<typeof setTimeout> | undefined

function showEmptyToast(): void {
  emptyToast.value = true
  clearTimeout(emptyToastTimer)
  emptyToastTimer = setTimeout(() => {
    emptyToast.value = false
  }, 2600)
}

onUnmounted(() => {
  clearTimeout(emptyToastTimer)
})

watch(
  () => trackState.value.status,
  (status) => {
    if (status !== 'success' || awaitingDate.value !== selectedDate.value) return
    if (track.value.length === 0) showEmptyToast()
    awaitingDate.value = null
  },
)

function confirmDate(date: string): void {
  const unchanged = date === selectedDate.value
  awaitingDate.value = date
  selectedDate.value = date
  dateConfirmed.value = true
  calendarOpen.value = false
  // Confirming the same day keeps the query key, so the watcher never fires and
  // an empty day would stay silent; report it here instead.
  if (unchanged && trackState.value.status === 'success' && track.value.length === 0) {
    showEmptyToast()
    awaitingDate.value = null
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('device.trackRecords')">
      <template #action>
        <button
          type="button"
          class="absolute right-3 top-1/2 h-11 w-11 -translate-y-1/2 flex items-center justify-center text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          :aria-label="t('device.selectDate')"
          @click="calendarOpen = true"
        >
          <span class="i-ph-calendar-blank text-title" aria-hidden="true" />
        </button>
      </template>
    </PageHeader>
    <main class="relative h-[calc(100svh-3.5rem)]">
      <span
        v-if="dateConfirmed"
        class="absolute right-4 top-3 z-20 h-8 flex items-center rounded-full bg-surface-elevated px-3 text-2nd-body shadow-lg"
      >
        {{ dateLabel }}
      </span>

      <QueryState :status="recentState.status" :error="recentState.error" @retry="reloadRecent()">
        <template v-if="recentState.data !== undefined">
          <QueryState :status="trackState.status" :error="trackState.error" @retry="reloadTrack()">
            <MapCanvas
              :center="center"
              :marker="recent"
              :marker-avatar="device?.avatar ?? null"
              :marker-name="device?.nick ?? ''"
              :track="track"
            />
            <p
              v-if="emptyToast"
              class="absolute bottom-6 left-4 right-4 z-10 mx-auto max-w-sm rounded-standard bg-surface-elevated px-4 py-3 text-center text-2nd-body text-text-secondary shadow-lg"
            >
              {{ t('device.noTrackForDate') }}
            </p>
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
