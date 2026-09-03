<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import Avatar from '~/components/Avatar.vue'
import { useToast } from '~/composables/useToast'
import {
  createRechargeOrder,
  getConnectedDevices,
  getRechargeDevices,
  updateDevice,
  type Device,
  type RechargeDevice,
} from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const router = useRouter()
const queryCache = useQueryCache()
const { showToast } = useToast()
const editing = shallowRef(false)
const nick = shallowRef('')
const recharging = shallowRef(false)

const deviceId = computed(() => {
  const value = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
})

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'devices'],
  query: getConnectedDevices,
})

const { state: rechargeState } = useQuery({
  key: () => ['device-management', 'recharge-devices'],
  query: getRechargeDevices,
})

const device = computed<Device | null>(() => {
  if (deviceId.value == null) return null
  return state.value.data?.find((item) => item.userId === deviceId.value) ?? null
})

const { mutateAsync: saveDevice, isLoading: saving } = useMutation({
  mutation: (value: { deviceId: number; nick: string }) => updateDevice(value.deviceId, value.nick),
})

const rechargeDevice = computed<RechargeDevice | null>(() => {
  if (deviceId.value == null) return null
  return rechargeState.value.data?.find((item) => item.userId === deviceId.value) ?? null
})

function formatPrice(price: number | undefined): string {
  return price == null ? t('device.notAvailable') : `¥${price.toFixed(2)}`
}

const { mutateAsync: createOrder, isLoading: creatingOrder } = useMutation({
  mutation: (selectedDeviceId: number) => createRechargeOrder([selectedDeviceId]),
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

function openGroups(): void {
  if (deviceId.value != null) router.push(`/devices/${deviceId.value}/groups`)
}

function openContacts(): void {
  if (deviceId.value != null) router.push(`/devices/${deviceId.value}/contacts`)
}

function openRecharge(): void {
  if (device.value && rechargeDevice.value) recharging.value = true
}

async function confirmRecharge(): Promise<void> {
  if (deviceId.value == null || creatingOrder.value) return
  try {
    await createOrder(deviceId.value)
    recharging.value = false
    showToast(t('device.rechargeSuccess'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <RouterView v-if="route.name !== '/devices/[id]'" />
  <div v-else class="min-h-screen min-h-svh bg-surface text-text-primary">
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
                class="ml-2 rounded-small p-2 text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40"
                :aria-label="t('device.editName')"
                @click="startEditing"
              >
                ✎
              </button>
            </div>
          </section>

          <dl class="mt-2 overflow-hidden rounded-standard border border-stroke bg-surface">
            <div class="flex items-center justify-between border-b border-stroke px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.activatedAt') }}</dt>
              <dd class="ml-4 text-right text-2nd-body">
                {{ device.activatedAt || t('device.notAvailable') }}
              </dd>
            </div>
            <div class="flex items-center justify-between border-b border-stroke px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.model') }}</dt>
              <dd class="ml-4 text-right text-2nd-body">
                {{ device.product || t('device.notAvailable') }}
              </dd>
            </div>
            <div class="flex items-center justify-between border-b border-stroke px-4 py-3">
              <dt class="text-2nd-body text-text-secondary">{{ t('device.deviceNumber') }}</dt>
              <dd class="ml-4 flex min-w-0 items-center text-right text-2nd-body">
                <span class="truncate">{{ device.imei || t('device.notAvailable') }}</span>
                <button
                  v-if="device.imei"
                  type="button"
                  class="ml-2 flex-none rounded-small p-1 text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40"
                  :aria-label="t('device.copyDeviceNumber')"
                  @click="copyDeviceNumber"
                >
                  ⧉
                </button>
              </dd>
            </div>
            <div class="flex items-center justify-between border-b border-stroke px-4 py-3">
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

          <button
            type="button"
            class="mt-4 min-h-12 w-full flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
            @click="openRecharge"
          >
            <span>{{ t('device.recharge') }}</span>
            <span aria-hidden="true" class="text-text-secondary">›</span>
          </button>

          <button
            type="button"
            class="mt-3 min-h-12 w-full flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
            @click="openGroups"
          >
            <span>{{ t('device.groups') }}</span>
            <span aria-hidden="true" class="text-text-secondary">›</span>
          </button>

          <button
            type="button"
            class="mt-3 min-h-12 w-full flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
            @click="openContacts"
          >
            <span>{{ t('device.contacts') }}</span>
            <span aria-hidden="true" class="text-text-secondary">›</span>
          </button>
        </template>
      </QueryState>
    </main>

    <BaseModal
      v-if="recharging && device"
      :title="t('device.confirmRecharge')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="creatingOrder ? t('device.saving') : t('modal.confirm')"
      :dismissible="!creatingOrder"
      @cancel="recharging = false"
      @confirm="confirmRecharge"
    >
      <p>
        {{
          t('device.rechargeConfirmMessage', {
            name: device.nick,
            price: formatPrice(rechargeDevice?.price),
          })
        }}
      </p>
      <p class="mt-2 text-small text-text-secondary">
        {{ t('device.model') }}: {{ device.product || t('device.notAvailable') }}
      </p>
      <p class="mt-1 text-small text-text-secondary">
        {{ t('device.deviceNumber') }}: {{ device.imei || t('device.notAvailable') }}
      </p>
      <p v-if="rechargeDevice" class="mt-1 text-small text-text-secondary">
        {{ t('device.iccid') }}: {{ rechargeDevice.iccid }}
      </p>
    </BaseModal>

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
