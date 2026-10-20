<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import DeviceListItem from '~/components/DeviceListItem.vue'
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
      <h2 class="mb-3 text-2nd-body font-semibold text-text-secondary">
        {{ t('device.connectedDevices') }}
      </h2>
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.data?.length === 0"
        :empty-text="t('device.emptyDevices')"
        @retry="reload()"
      >
        <ul class="space-y-3">
          <DeviceListItem
            v-for="device in state.data"
            :key="device.userId"
            :name="device.nick"
            :avatar="device.avatar"
            :product="device.product"
            @click="openDevice(device)"
          />
        </ul>
      </QueryState>
    </main>
  </div>
</template>
