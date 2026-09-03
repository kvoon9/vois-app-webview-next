<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { hideBrokenImage } from '~/utils/image'
import { getConnectedDevices, type Device } from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()

const { state, refetch: reload } = useQuery({
  key: ['device-management', 'devices'],
  query: getConnectedDevices,
})

function openDevice(device: Device): void {
  router.push(`/devices/${device.userId}`)
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.title')" />

    <main class="p-4">
      <nav class="mb-4" :aria-label="t('device.recharge')">
        <router-link
          to="/devices/recharge"
          class="min-h-12 flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
        >
          <span>{{ t('device.batchRecharge') }}</span>
          <span aria-hidden="true" class="text-text-secondary">›</span>
        </router-link>
      </nav>

      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.data?.length === 0"
        :empty-text="t('device.emptyDevices')"
        @retry="reload()"
      >
        <ul class="space-y-3">
          <li
            v-for="device in state.data"
            :key="device.userId"
            class="rounded-standard border p-4"
            :class="
              device.online
                ? 'border-primary/40 bg-surface-selected'
                : 'border-stroke bg-surface-muted opacity-70'
            "
          >
            <button
              type="button"
              class="min-w-0 w-full flex items-center text-left"
              @click="openDevice(device)"
            >
              <span
                class="relative h-12 w-12 flex-none flex items-center justify-center overflow-hidden rounded-full bg-surface text-text-secondary"
              >
                {{ device.nick.trim().slice(0, 1) || '?' }}
                <img
                  v-if="device.avatar"
                  :src="device.avatar"
                  alt=""
                  class="absolute inset-0 h-full w-full object-cover"
                  @error="hideBrokenImage"
                />
                <span
                  class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface"
                  :class="device.online ? 'bg-blue-500' : 'bg-stroke'"
                  :aria-label="t(device.online ? 'device.online' : 'device.offline')"
                  role="img"
                />
              </span>
              <span class="ml-3 min-w-0 flex-1">
                <span class="block truncate text-body font-medium">{{ device.nick }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">
                  {{ device.product }}
                </span>
              </span>
              <span aria-hidden="true" class="ml-2 flex-none text-text-secondary">›</span>
            </button>
          </li>
        </ul>
      </QueryState>
    </main>
  </div>
</template>
