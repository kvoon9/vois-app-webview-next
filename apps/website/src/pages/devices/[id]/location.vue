<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import MapCanvas from '~/components/device/MapCanvas.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { createPageLocationSource, useRealtimeLocation } from '~/composables/useRealtimeLocation'
import {
  getDeviceDetail,
  getDeviceFence,
  getDeviceTrackMode,
  getRecentTrackPoint,
  type DeviceFence,
  type TrackFrequency,
  type TrackPoint,
} from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()

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

/** Same key as the device-detail page, so navigating back and forth shares the cache. */
const { state: deviceState } = useQuery({
  key: () => ['device-management', 'device', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return getDeviceDetail(deviceId.value)
  },
})
const device = computed(() => deviceState.value.data ?? null)

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

/** Native's 围栏 shortcut: explain the gesture first, then open the editor. */
const addConfirmation = shallowRef(false)

function openFenceEditor(): void {
  if (deviceId.value == null) return
  void router.push(`/devices/${deviceId.value}/fence`)
}

function openFence(): void {
  // An existing fence goes straight to the editor, where it is editable and
  // deletable; only a missing fence asks for confirmation first.
  if (fence.value) openFenceEditor()
  else addConfirmation.value = true
}

function startFence(): void {
  addConfirmation.value = false
  openFenceEditor()
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('device.locationAndFence')" />
    <main class="relative h-[calc(100svh-3.5rem)]">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <MapCanvas
          :center="center"
          :marker="deviceMarker"
          :marker-avatar="device?.avatar ?? null"
          :marker-name="device?.nick ?? ''"
          :me="myMarker"
          :fence="fence"
        />

        <!-- Native chrome: a vertical stack of round white buttons on the right.
             Sharing has no bridge call behind it, so it stays out. -->
        <div class="absolute right-4 top-4 z-2 flex flex-col space-y-3">
          <button
            type="button"
            class="h-12 w-12 flex items-center justify-center rounded-full bg-surface-elevated text-primary shadow-lg"
            :aria-label="fence ? t('device.fenceEdit') : t('device.fenceAdd')"
            @click="openFence"
          >
            <span class="i-ph-crosshair text-xl" aria-hidden="true" />
          </button>
        </div>

        <div class="absolute bottom-4 left-4 right-4 z-2 flex flex-col items-start space-y-2">
          <!-- The live location runs in the background, so it reports as one
               compact line instead of native-free card furniture. -->
          <button
            v-if="myStatus"
            type="button"
            class="min-h-9 flex items-center rounded-full bg-surface-elevated px-3 text-small text-text-secondary shadow-lg"
            :class="canRetryRealtime ? '' : 'pointer-events-none'"
            :aria-label="myStatus"
            @click="retryRealtime"
          >
            <span
              v-if="realtime.status.value === 'tracking'"
              class="mr-2 inline-block h-2 w-2 flex-none rounded-full bg-primary"
              aria-hidden="true"
            />
            <span>{{ myStatus }}</span>
            <span v-if="myTime" class="ml-2">{{ myTime }}</span>
          </button>

          <RouterLink
            v-if="fenceWarning && deviceId != null"
            :to="`/devices/${deviceId}/track-setting`"
            class="w-full rounded-large bg-surface-elevated px-4 py-3 text-2nd-body shadow-lg"
          >
            {{ fenceWarning }}
          </RouterLink>
        </div>
      </QueryState>
    </main>

    <BaseModal
      v-if="addConfirmation"
      :title="t('device.fenceAdd')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="t('modal.confirm')"
      @cancel="addConfirmation = false"
      @confirm="startFence"
    >
      <p>{{ t('device.fenceAddConfirm') }}</p>
    </BaseModal>
  </div>
</template>
