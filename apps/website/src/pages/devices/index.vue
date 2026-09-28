<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Avatar from '~/components/Avatar.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
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
  <div class="page">
    <PageHeader :title="t('device.title')" />

    <main class="p-4">
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
            class="rounded-standard p-4"
            :class="device.online ? 'bg-surface-selected' : 'bg-surface-muted opacity-70'"
          >
            <button
              type="button"
              class="min-w-0 w-full flex items-center text-left"
              @click="openDevice(device)"
            >
              <Avatar
                :name="device.nick"
                :src="device.avatar"
                :online="device.online"
                show-status
                :status-label="t(device.online ? 'device.online' : 'device.offline')"
              />
              <span class="ml-3 min-w-0 flex-1">
                <span class="block truncate text-body font-medium">{{ device.nick }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">
                  {{ device.product }}
                </span>
              </span>
              <span aria-hidden="true" class="row-chevron" />
            </button>
          </li>
        </ul>
      </QueryState>
    </main>
  </div>
</template>
