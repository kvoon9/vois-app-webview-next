<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import MapCanvas from '~/components/device/MapCanvas.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { createPageLocationSource, useRealtimeLocation } from '~/composables/useRealtimeLocation'
import {
  getDeviceFence,
  getDeviceTrackMode,
  getRecentTrackPoint,
  type DeviceFence,
  type TrackFrequency,
  type TrackPoint,
} from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()

const deviceId = computed(() => parseRouteParamId(route.params.id))

/** Fence + report mode + the day's last track point, all real endpoints. */
const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'device', 'location', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return Promise.all([
      getDeviceFence(deviceId.value),
      getDeviceTrackMode(deviceId.value),
      getRecentTrackPoint(deviceId.value),
    ])
  },
})

const fence = computed<DeviceFence | null>(() => state.value.data?.[0] ?? null)
const reportFrequency = computed<TrackFrequency>(() => state.value.data?.[1] ?? 'off')
const recentPoint = computed<TrackPoint | null>(() => state.value.data?.[2] ?? null)

/** Native warns on both `off` and `low`: the fence cannot fire either way. */
const fenceWarning = computed(() => {
  if (reportFrequency.value === 'off') return t('device.fenceDisabledTip')
  if (reportFrequency.value === 'low') return t('device.fenceLowFrequencyTip')
  return ''
})

/**
 * The phone's own live position through the bridge (`start-location` loop).
 * In the DevServer this falls back to a walking debug dot so the flow is
 * drivable without the app; the device's position never comes from here.
 */
const realtime = useRealtimeLocation({
  source: createPageLocationSource({ lng: 114.0668, lat: 22.6305 }),
  immediate: true,
})

const myMarker = computed(() => {
  const fix = realtime.point.value
  return fix ? { lng: fix.longitude, lat: fix.latitude } : null
})

/** The device's dot: the day's last track point until a fresher source exists. */
const deviceMarker = computed(() =>
  recentPoint.value ? { lng: recentPoint.value.lng, lat: recentPoint.value.lat } : null,
)

const center = computed(
  () =>
    deviceMarker.value ??
    myMarker.value ?? {
      lng: fence.value?.lng ?? 114.0668,
      lat: fence.value?.lat ?? 22.6305,
    },
)

const deviceTime = computed(() => recentPoint.value?.time.slice(11) ?? '')

const myTime = computed(() => {
  const fix = realtime.point.value
  if (!fix) return ''
  const date = new Date(fix.time)
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  const ss = `${date.getSeconds()}`.padStart(2, '0')
  return `${hh}:${mm}:${ss}`
})

/** One tap to restart the loop after it gave up or hit a permission wall. */
const canRetryRealtime = computed(
  () => realtime.status.value === 'error' || realtime.status.value === 'denied',
)

function retryRealtime(): void {
  if (canRetryRealtime.value) realtime.start()
}

const myStatus = computed(() => {
  switch (realtime.status.value) {
    case 'tracking':
      return t('device.myLocationTracking')
    case 'starting':
      // While native's dialog holds the start answer, the permission probe
      // labels the wait; it never changes what gets called.
      return realtime.permission.value === 'denied'
        ? t('device.realtimePendingPermission')
        : t('device.myLocationWaiting')
    case 'denied':
      return t('device.realtimeDenied')
    case 'error':
      return t('device.myLocationError')
    case 'unsupported':
      return ''
    default:
      return t('device.myLocationIdle')
  }
})
</script>

<template>
  <div class="page">
    <PageHeader :title="t('device.locationAndFence')" />
    <main class="relative h-[calc(100svh-3.5rem)]">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <MapCanvas :center="center" :marker="deviceMarker" :me="myMarker" :fence="fence" />

        <div
          class="absolute left-4 right-4 top-4 z-2 rounded-large bg-surface-elevated px-5 py-4 shadow-lg"
        >
          <p class="flex items-center text-2nd-body">
            <span>{{ t('device.deviceLocation') }}</span>
            <span v-if="deviceTime" class="ml-auto pl-3 text-text-secondary">
              {{ deviceTime }}
            </span>
          </p>
          <p
            v-if="myStatus"
            class="mt-1 flex items-center text-2nd-body text-text-secondary"
            :class="canRetryRealtime ? 'cursor-pointer' : ''"
            v-on="canRetryRealtime ? { click: retryRealtime } : {}"
          >
            <span
              v-if="realtime.status.value === 'tracking'"
              class="mr-2 inline-block h-2 w-2 flex-none rounded-full bg-primary"
              aria-hidden="true"
            />
            <span>{{ myStatus }}</span>
            <span v-if="myTime" class="ml-auto pl-3">{{ myTime }}</span>
          </p>

          <!-- The fence lives in a row of this card: a floating button would sit on
               top of AMap's zoom controls and the dev-only devtools toggle. -->
          <RouterLink
            v-if="deviceId != null"
            :to="`/devices/${deviceId}/fence`"
            class="mt-2 min-h-10 flex items-center justify-between text-body"
          >
            <span>{{ fence ? t('device.fenceEdit') : t('device.fenceAdd') }}</span>
            <span class="row-chevron" aria-hidden="true" />
          </RouterLink>
        </div>

        <RouterLink
          v-if="fenceWarning && deviceId != null"
          :to="`/devices/${deviceId}/track-setting`"
          class="absolute bottom-4 left-4 right-4 z-2 rounded-large bg-surface-elevated px-5 py-4 shadow-lg"
        >
          <span>{{ fenceWarning }}</span>
        </RouterLink>
      </QueryState>
    </main>
  </div>
</template>
