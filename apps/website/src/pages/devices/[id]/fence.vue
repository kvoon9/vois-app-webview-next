<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, onMounted, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import MapCanvas from '~/components/device/MapCanvas.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { useAMap, type AMapPoint } from '~/composables/useAMap'
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
const { reverseGeocode } = useAMap()

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
const address = shallowRef('')
/**
 * Native leaves 围栏中心 empty until the centre is set: the seeded position only
 * places the map, it does not claim to be the user's choice.
 */
const picked = shallowRef(false)
const deleteConfirmation = shallowRef(false)

/** Reverse-geocode replies can land out of order; only the latest one may win. */
let geocodeRequest = 0

/** Seeds the draft from the stored fence, else from the last known position. */
watch(
  () => state.value.data,
  (data) => {
    if (!data) return
    const stored = data[0]
    if (stored) {
      const storedCenter = { lng: stored.lng, lat: stored.lat }
      center.value = storedCenter
      radius.value = stored.radius
      name.value = stored.name
      void showAddress(storedCenter)
      return
    }
    const recent = data[1]
    if (recent) center.value = { lng: recent.lng, lat: recent.lat }
  },
  { immediate: true },
)

/** Native explains the gesture once on entry, then gets out of the map's way. */
onMounted(() => {
  showToast(t('device.fencePickHint'), { type: 'info' })
})

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

function formatPoint(point: AMapPoint): string {
  return `${point.lng.toFixed(5)}, ${point.lat.toFixed(5)}`
}

/**
 * The address of the centre. Until one is picked the row stays empty like
 * native; when the lookup is unavailable the coordinates keep it informative.
 */
const centerText = computed(() => {
  if (!center.value || !(picked.value || fence.value)) return ''
  return address.value || formatPoint(center.value)
})

async function showAddress(point: AMapPoint): Promise<void> {
  const request = ++geocodeRequest
  try {
    const next = await reverseGeocode(point)
    if (request === geocodeRequest) address.value = next
  } catch {
    // Coordinates are the fallback; the row never shows a stale address.
    if (request === geocodeRequest) address.value = ''
  }
}

function pickCenter(point: AMapPoint): void {
  center.value = point
  picked.value = true
  void showAddress(point)
}

/** Native's ± buttons step the radius by 50 m and clamp to 200–1000 m. */
function stepRadius(delta: number): void {
  radius.value = Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, radius.value + delta))
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
        <MapCanvas picker :center="mapCenter" :fence="preview" @pick="pickCenter" />

        <!-- Radius sits at the top like native: the two end labels name the
             range, the round buttons step it, the slider carries the green dot. -->
        <section
          class="absolute left-0 right-0 top-0 z-2 rounded-b-[28px] bg-surface-elevated px-4 pb-4 pt-3 shadow-lg"
        >
          <div class="flex items-center">
            <button
              type="button"
              class="h-9 w-9 flex-none flex items-center justify-center rounded-full bg-surface-muted text-header text-text-primary"
              aria-label="-50"
              @click="stepRadius(-RADIUS_STEP)"
            >
              −
            </button>
            <span class="ml-3 flex-none text-small text-text-secondary">
              {{ t('device.fenceRadiusValue', { n: MIN_RADIUS }) }}
            </span>
            <input
              v-model.number="radius"
              type="range"
              :min="MIN_RADIUS"
              :max="MAX_RADIUS"
              :step="RADIUS_STEP"
              class="mx-3 min-w-0 flex-1 accent-primary"
              :aria-label="t('device.fenceRadius')"
            />
            <span class="mr-3 flex-none text-small text-text-secondary">
              {{ t('device.fenceRadiusValue', { n: MAX_RADIUS }) }}
            </span>
            <button
              type="button"
              class="h-9 w-9 flex-none flex items-center justify-center rounded-full bg-surface-muted text-header text-text-primary"
              aria-label="+50"
              @click="stepRadius(RADIUS_STEP)"
            >
              +
            </button>
          </div>
        </section>

        <section
          class="absolute bottom-0 left-0 right-0 z-2 rounded-t-[28px] bg-surface-dialog px-5 pb-6 pt-4"
        >
          <div class="min-h-11 flex items-center justify-between">
            <span class="flex-none text-body">{{ t('device.fenceCenter') }}</span>
            <span class="ml-4 min-w-0 flex-1 text-right text-2nd-body text-text-secondary">
              {{ centerText }}
            </span>
          </div>
          <div class="min-h-11 flex items-center justify-between">
            <span class="flex-none text-body">{{ t('device.fenceRadius') }}</span>
            <span class="text-2nd-body text-text-secondary">
              {{ t('device.fenceRadiusValue', { n: radius }) }}
            </span>
          </div>

          <label class="mt-3 min-h-14 flex items-center rounded-standard bg-surface-elevated px-4">
            <span class="flex-none text-2nd-body text-text-secondary">
              {{ t('device.fenceName') }}
            </span>
            <input
              v-model="name"
              type="text"
              class="ml-3 min-w-0 flex-1 bg-transparent text-right text-body outline-none placeholder:text-text-secondary"
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
            {{ saveMutation.isLoading.value ? t('device.saving') : t('device.fenceSave') }}
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
