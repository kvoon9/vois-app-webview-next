<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import Avatar from '~/components/Avatar.vue'
import { useToast } from '~/composables/useToast'
import { getConnectedDevices, updateDevice, type Device } from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const queryCache = useQueryCache()
const { showToast } = useToast()
const editing = shallowRef(false)
const nick = shallowRef('')

const deviceId = computed(() => {
  const value = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
})

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'devices'],
  query: getConnectedDevices,
})

const device = computed<Device | null>(() => {
  if (deviceId.value == null) return null
  return state.value.data?.find((item) => item.userId === deviceId.value) ?? null
})

const { mutateAsync: saveDevice, isLoading: saving } = useMutation({
  mutation: (value: { deviceId: number; nick: string }) => updateDevice(value.deviceId, value.nick),
})

function startEditing(): void {
  if (!device.value) return
  nick.value = device.value.nick
  editing.value = true
}

async function saveName(): Promise<void> {
  if (deviceId.value == null || !nick.value.trim() || saving.value) return
  try {
    await saveDevice({ deviceId: deviceId.value, nick: nick.value.trim() })
    editing.value = false
    await queryCache.invalidateQueries({ key: ['device-management', 'devices'] })
    showToast(t('device.updated'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

async function copyDeviceNumber(): Promise<void> {
  if (!device.value?.imei) return
  try {
    await navigator.clipboard.writeText(device.value.imei)
    showToast(t('device.copied'))
  } catch {
    showToast(t('device.copyFailed'), { type: 'error' })
  }
}
</script>

<template>
  <RouterView v-if="route.name !== '/devices/[id]'" />
  <div v-else class="page">
    <PageHeader :title="device?.nick ?? t('device.title')" />
    <main class="p-4">
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.status === 'success' && !device"
        :empty-text="t('device.notFound')"
        @retry="reload()"
      >
        <template v-if="device">
          <section class="flex flex-col items-center py-4 text-center">
            <Avatar :name="device.nick" :src="device.avatar" size="lg" />
            <div class="mt-3 flex items-center">
              <h2 class="text-header font-semibold">{{ device.nick }}</h2>
              <button
                type="button"
                class="icon-button ml-2 p-2 focus-visible:ring-2 focus-visible:ring-primary/40"
                :aria-label="t('device.editName')"
                @click="startEditing"
              >
                <span class="i-ph-pencil-simple" aria-hidden="true" />
              </button>
            </div>
          </section>

          <dl class="mt-2 overflow-hidden panel">
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.activatedAt') }}</dt>
              <dd class="ml-4 text-right text-2nd-body">
                {{ device.activatedAt || t('device.notAvailable') }}
              </dd>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.model') }}</dt>
              <dd class="ml-4 text-right text-2nd-body">
                {{ device.product || t('device.notAvailable') }}
              </dd>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.deviceNumber') }}</dt>
              <dd class="ml-4 flex min-w-0 items-center text-right text-2nd-body">
                <span class="truncate">{{ device.imei || t('device.notAvailable') }}</span>
                <button
                  v-if="device.imei"
                  type="button"
                  class="icon-button ml-2 p-1 focus-visible:ring-2 focus-visible:ring-primary/40"
                  :aria-label="t('device.copyDeviceNumber')"
                  @click="copyDeviceNumber"
                >
                  <span class="i-ph-copy" aria-hidden="true" />
                </button>
              </dd>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.version') }}</dt>
              <dd class="ml-4 text-right text-2nd-body">
                {{ device.version || t('device.notAvailable') }}
              </dd>
            </div>
            <div class="flex items-center justify-between px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.userNumber') }}</dt>
              <dd class="ml-4 text-right text-2nd-body">
                {{ device.userNum || t('device.notAvailable') }}
              </dd>
            </div>
          </dl>

          <RouterLink :to="`/devices/${deviceId}/groups`" class="mt-3 min-h-12 w-full nav-item">
            <span>{{ t('device.groups') }}</span>
            <span class="row-chevron" aria-hidden="true" />
          </RouterLink>
        </template>
      </QueryState>
    </main>

    <BaseModal
      v-if="editing"
      :title="t('device.editName')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="saving ? t('device.saving') : t('modal.confirm')"
      @cancel="editing = false"
      @confirm="saveName"
    >
      <label class="block text-2nd-body text-text-secondary" for="device-name">
        {{ t('device.name') }}
      </label>
      <input
        id="device-name"
        v-model="nick"
        class="input-field mt-2"
        type="text"
        maxlength="64"
        :disabled="saving"
        @keyup.enter="saveName"
      />
    </BaseModal>
  </div>
</template>
