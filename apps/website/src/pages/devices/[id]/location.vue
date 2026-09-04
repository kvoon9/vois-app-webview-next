<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import MapCanvas from '~/components/device/MapCanvas.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { getDeviceLocation } from '~/utils/device-api'

type RouteParam = string | string[] | undefined

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })

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

const location = computed(() => state.value.data ?? null)
const center = computed(() => ({
  lng: location.value?.lng ?? 114.0668,
  lat: location.value?.lat ?? 22.6305,
}))
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.locationAndFence')" />
    <main class="relative h-[calc(100svh-3.5rem)]">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="location">
          <MapCanvas
            :center="center"
            :marker="{ lng: location.lng, lat: location.lat }"
            :fence="location.fence"
          />
          <RouterLink
            v-if="location.reportFrequency === 'off'"
            :to="`/devices/${deviceId}/track-setting`"
            class="absolute left-4 right-4 top-4 z-2 rounded-large bg-surface px-5 py-4 shadow-lg"
          >
            <span class="flex items-start">
              <span
                class="mr-3 h-7 w-7 flex-none flex items-center justify-center rounded-full border-2 border-primary text-header text-primary"
                aria-hidden="true"
              >
                i
              </span>
              <span class="text-body font-medium">{{ t('device.fenceDisabledTip') }}</span>
            </span>
          </RouterLink>
        </template>
      </QueryState>
    </main>
  </div>
</template>
