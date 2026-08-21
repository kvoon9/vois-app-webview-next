<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { useRouter } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useAccountId } from '~/composables/useAccountId'
import { hideBrokenImage } from '~/utils/image'
import { getSmartDevices, type SmartDevice } from '~/utils/translation-api'

const router = useRouter()
const { accountQuery } = useAccountId()

const { state, refetch: reload } = useQuery({
  key: ['devices'],
  query: getSmartDevices,
})

function openDevice(device: SmartDevice): void {
  // 设备没有群组（后端确认），直接进入该设备的好友翻译设置
  router.push({
    path: '/settings/friends',
    query: { ...accountQuery.value, 'login-id': String(device.userId), name: device.nick },
  })
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="$t('settings.devices')" />

    <main class="p-4">
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.data?.length === 0"
        :empty-text="$t('translation.emptyDevices')"
        @retry="reload()"
      >
        <ul class="space-y-3">
          <li v-for="device in state.data" :key="device.userId" class="card flex items-center">
            <button
              type="button"
              class="min-w-0 flex flex-1 items-center text-left"
              @click="openDevice(device)"
            >
              <span
                class="relative h-11 w-11 flex-none flex items-center justify-center overflow-hidden rounded-full bg-surface-muted text-text-secondary"
              >
                {{ device.nick.slice(0, 1) }}
                <img
                  v-if="device.avatar"
                  :src="device.avatar"
                  alt=""
                  class="absolute inset-0 h-full w-full object-cover"
                  @error="hideBrokenImage"
                />
              </span>
              <span class="min-w-0 ml-3 flex-1">
                <span class="block truncate text-body font-medium">{{ device.nick }}</span>
                <span class="mt-0.5 block truncate text-small text-text-secondary">
                  {{ device.product }} · IMEI {{ device.imei }}
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
