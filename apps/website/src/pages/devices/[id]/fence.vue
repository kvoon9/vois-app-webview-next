<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import MapCanvas from '~/components/device/MapCanvas.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import type { AMapPoint } from '~/composables/useAMap'
import { usePageBack } from '~/composables/usePageBack'
import { useToast } from '~/composables/useToast'
import {
  deleteDeviceFence,
  getDeviceFence,
  getRecentTrackPoint,
  setDeviceFence,
  type DeviceFence,
  type TrackPoint,
} from '~/utils/device-api'
import { MAX_NAME_LENGTH } from '~/utils/field-schema'

/** Fallback centre (Shenzhen) while the device has neither a fence nor a fix. */
const DEFAULT_CENTER: AMapPoint = { lng: 114.0668, lat: 22.6305 }
/** Native's radius range and step, in meters. */
const MIN_RADIUS = 200
const MAX_RADIUS = 1000
const RADIUS_STEP = 50

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const queryCache = useQueryCache()
const { goBack } = usePageBack()
const { showToast } = useToast()

const deviceId = computed(() => parseRouteParamId(route.params.id))

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'device', 'fence', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    return Promise.all([getDeviceFence(deviceId.value), getRecentTrackPoint(deviceId.value)])
  },
})

const fence = computed<DeviceFence | null>(() => state.value.data?.[0] ?? null)
const recentPoint = computed<TrackPoint | null>(() => state.value.data?.[1] ?? null)

const center = shallowRef<AMapPoint | null>(null)
const radius = shallowRef(300)
const name = shallowRef('')
const deleteConfirmation = shallowRef(false)

/** Seed the draft from the stored fence, else from the last known position. */
watch(
  () => state.value.data,
  (data) => {
    if (!data) return
    const stored = data[0]
    if (stored) {
      center.value = { lng: stored.lng, lat: stored.lat }
      radius.value = stored.radius
      name.value = stored.name
      return
    }
    const recent = data[1]
    if (recent) center.value = { lng: recent.lng, lat: recent.lat }
  },
  { immediate: true },
)

const mapCenter = computed(() => center.value ?? recentPoint.value ?? DEFAULT_CENTER)

/** The circle the map previews; a stored fence keeps its id and enabled state. */
const preview = computed<DeviceFence | null>(() =>
  center.value
    ? {
        id: fence.value?.id ?? 0,
        enable: true,
        name: name.value,
        lng: center.value.lng,
        lat: center.value.lat,
        radius: radius.value,
      }
    : null,
)

function pickCenter(point: AMapPoint): void {
  center.value = point
}

const saveMutation = useMutation({
  mutation: async (input: { lat: number; lng: number; radius: number; name: string }) => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    await setDeviceFence(deviceId.value, input)
  },
})

const removeMutation = useMutation({
  mutation: async (geofenceId: number) => {
    if (deviceId.value == null) throw new Error(t('device.invalidDevice'))
    await deleteDeviceFence(deviceId.value, geofenceId)
  },
})

async function save(): Promise<void> {
  if (saveMutation.isLoading.value) return
  if (!center.value) {
    showToast(t('device.fencePickCenterRequired'), { type: 'error' })
    return
  }
  const parsedName = parseName(name.value)
  if (parsedName === null) return
  try {
    await saveMutation.mutateAsync({
      lat: center.value.lat,
      lng: center.value.lng,
      radius: radius.value,
      name: parsedName,
    })
    await queryCache.invalidateQueries({ key: ['device-management'] })
    showToast(t('device.fenceSaved'))
    await goBack()
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

/** Returns the trimmed name, or null after telling the user what is missing. */
function parseName(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    showToast(t('device.fenceNameRequired'), { type: 'error' })
    return null
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    showToast(t('validation.nameTooLong', { max: MAX_NAME_LENGTH }), { type: 'error' })
    return null
  }
  return trimmed
}

async function removeFence(): Promise<void> {
  const current = fence.value
  if (!current || removeMutation.isLoading.value) return
  try {
    await removeMutation.mutateAsync(current.id)
    deleteConfirmation.value = false
    await queryCache.invalidateQueries({ key: ['device-management'] })
    showToast(t('device.fenceDeleted'))
    await goBack()
  } catch (error) {
    deleteConfirmation.value = false
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('device.fenceTitle')" />

    <main class="relative h-[calc(100svh-3.5rem)]">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <MapCanvas
          picker
          :center="mapCenter"
          :fence="preview"
          :marker="center"
          @pick="pickCenter"
        />

        <p
          class="absolute left-4 right-4 top-4 z-2 rounded-large bg-surface-elevated px-5 py-4 text-2nd-body shadow-lg"
        >
          {{ t('device.fencePickHint') }}
        </p>

        <section
          class="absolute bottom-0 left-0 right-0 z-2 rounded-t-[28px] bg-surface-dialog px-5 pb-6 pt-5"
        >
          <div class="flex items-center justify-between">
            <span class="text-body">{{ t('device.fenceRadius') }}</span>
            <span class="text-2nd-body text-text-secondary">
              {{ t('device.fenceRadiusValue', { n: radius }) }}
            </span>
          </div>
          <input
            v-model.number="radius"
            type="range"
            :min="MIN_RADIUS"
            :max="MAX_RADIUS"
            :step="RADIUS_STEP"
            class="mt-2 w-full accent-primary"
            :aria-label="t('device.fenceRadius')"
          />

          <label class="mt-4 min-h-14 flex items-center rounded-standard bg-surface-elevated px-4">
            <span class="text-2nd-body text-text-secondary">{{ t('device.fenceName') }}</span>
            <input
              v-model="name"
              type="text"
              class="ml-3 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-secondary"
              :maxlength="MAX_NAME_LENGTH"
              :placeholder="t('device.fenceNamePlaceholder')"
              :aria-label="t('device.fenceName')"
            />
          </label>

          <button
            type="button"
            class="mt-4 btn-primary"
            :disabled="saveMutation.isLoading.value"
            @click="save"
          >
            {{ saveMutation.isLoading.value ? t('device.saving') : t('modal.ok') }}
          </button>

          <button
            v-if="fence"
            type="button"
            class="mt-3 btn-danger"
            :disabled="removeMutation.isLoading.value"
            @click="deleteConfirmation = true"
          >
            {{ t('device.fenceDelete') }}
          </button>
        </section>
      </QueryState>
    </main>

    <BaseModal
      v-if="deleteConfirmation"
      :title="t('device.fenceDelete')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="removeMutation.isLoading.value ? t('device.saving') : t('modal.confirm')"
      :dismissible="!removeMutation.isLoading.value"
      tone="danger"
      @cancel="deleteConfirmation = false"
      @confirm="removeFence"
    >
      <p>{{ t('device.fenceDeleteConfirm') }}</p>
    </BaseModal>
  </div>
</template>
