<script setup lang="ts">
import { getLocalTimeZone, parseDate, today } from '@internationalized/date'
import { useQuery } from '@pinia/colada'
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import MapCanvas from '~/components/device/MapCanvas.vue'
import TrackCalendarModal from '~/components/device/TrackCalendarModal.vue'
import TrackPointPopup from '~/components/device/TrackPointPopup.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { useAMap, type AMapPoint } from '~/composables/useAMap'
import { getDeviceDetail, getDeviceTrack, getRecentTrackPoint } from '~/utils/device-api'
import { buildDayTrack, toMapPoint } from '~/utils/track'

/** Fallback center (Shenzhen) while there is no fix and no track point yet. */
const DEFAULT_CENTER: AMapPoint = { lng: 114.0668, lat: 22.6305 }

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const { reverseGeocode } = useAMap()
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
const trackPoints = computed(() => buildDayTrack(trackState.value.data ?? []))
const selectedIndex = shallowRef<number | null>(null)
const focus = shallowRef<{ point: AMapPoint; nonce: number } | null>(null)
const pointAddress = shallowRef('')
const pointAddressPending = shallowRef(false)
const addressCache = new Map<string, string>()
let regeoRequest = 0

const selectedPoint = computed(() =>
  selectedIndex.value == null ? null : (trackPoints.value[selectedIndex.value] ?? null),
)

/** The date the map shows, as native's `M/d` tag. */
const dateLabel = computed(() => {
  const date = parseDate(selectedDate.value)
  return `${date.month}/${date.day}`
})

const center = computed(
  () => trackPoints.value[trackPoints.value.length - 1] ?? recent.value ?? DEFAULT_CENTER,
)

async function loadAddress(index: number, point: AMapPoint): Promise<void> {
  const request = ++regeoRequest
  const key = `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`
  const cached = addressCache.get(key)
  if (cached !== undefined) {
    pointAddress.value = cached
    pointAddressPending.value = false
    return
  }
  pointAddress.value = ''
  pointAddressPending.value = true
  try {
    const text = await reverseGeocode(point)
    // Cache even after the user moves on, so reopening the point is instant.
    addressCache.set(key, text)
    if (request === regeoRequest && selectedIndex.value === index) {
      pointAddress.value = text
      pointAddressPending.value = false
    }
  } catch {
    if (request === regeoRequest && selectedIndex.value === index) {
      pointAddress.value = ''
      pointAddressPending.value = false
    }
  }
}

function selectPoint(index: number): void {
  const point = trackPoints.value[index]
  if (!point) return
  selectedIndex.value = index
  focus.value = { point, nonce: (focus.value?.nonce ?? 0) + 1 }
  void loadAddress(index, point)
}

function stepPoint(delta: number): void {
  const current = selectedIndex.value
  if (current == null) return
  selectPoint(Math.min(Math.max(current + delta, 0), trackPoints.value.length - 1))
}

function closePoint(): void {
  selectedIndex.value = null
  pointAddress.value = ''
  pointAddressPending.value = false
  regeoRequest++
}

function resetPointSelection(): void {
  closePoint()
  focus.value = null
  addressCache.clear()
}

watch(selectedDate, resetPointSelection)

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
  regeoRequest++
})

watch(
  () => trackState.value.status,
  (status) => {
    if (status !== 'success') {
      closePoint()
      focus.value = null
      return
    }
    if (awaitingDate.value !== selectedDate.value) return
    if (trackPoints.value.length === 0) showEmptyToast()
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
  if (unchanged && trackState.value.status === 'success' && trackPoints.value.length === 0) {
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
    <main class="map-viewport">
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
              :track="trackPoints"
              :selected-track-index="selectedIndex"
              :focus="focus"
              @select-track-point="selectPoint"
            />
            <TrackPointPopup
              v-if="selectedPoint"
              :point="selectedPoint"
              :index="selectedIndex ?? 0"
              :count="trackPoints.length"
              :address="pointAddress"
              :address-pending="pointAddressPending"
              @close="closePoint"
              @previous="stepPoint(-1)"
              @next="stepPoint(1)"
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
