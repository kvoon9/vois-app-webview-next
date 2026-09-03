<script setup lang="ts">
import { useMutation, useQuery } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { useToast } from '~/composables/useToast'
import { createRechargeOrder, getRechargeDevices, type RechargeDevice } from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const { showToast } = useToast()
const selectedIds = shallowRef<number[]>([])
const confirming = shallowRef(false)

const { state, refetch: reload } = useQuery({
  key: ['device-management', 'recharge-devices'],
  query: getRechargeDevices,
})

const devices = computed(() => state.value.data ?? [])
const selectedDevices = computed(() =>
  devices.value.filter((device) => selectedIds.value.includes(device.userId)),
)
const selectedCount = computed(() => selectedDevices.value.length)
const totalPrice = computed(() =>
  selectedDevices.value.reduce((total, device) => total + device.price, 0),
)
const allSelected = computed(
  () => devices.value.length > 0 && selectedCount.value === devices.value.length,
)

const { mutateAsync: createOrder, isLoading: creatingOrder } = useMutation({
  mutation: (deviceIds: readonly number[]) => createRechargeOrder(deviceIds),
})

function formatPrice(price: number): string {
  return `¥${price.toFixed(2)}`
}

function toggleDevice(device: RechargeDevice): void {
  selectedIds.value = selectedIds.value.includes(device.userId)
    ? selectedIds.value.filter((id) => id !== device.userId)
    : [...selectedIds.value, device.userId]
}

function toggleAll(): void {
  selectedIds.value = allSelected.value ? [] : devices.value.map((device) => device.userId)
}

function openConfirmation(): void {
  if (selectedCount.value > 0) confirming.value = true
}

async function confirmRecharge(): Promise<void> {
  if (selectedCount.value === 0 || creatingOrder.value) return
  try {
    await createOrder(selectedIds.value)
    confirming.value = false
    selectedIds.value = []
    showToast(t('device.rechargeSuccess'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.rechargeDevices')" />

    <main class="p-4 pb-28">
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.data?.length === 0"
        :empty-text="t('device.emptyRechargeDevices')"
        @retry="reload()"
      >
        <ul class="space-y-3">
          <li v-for="device in devices" :key="device.userId">
            <label
              class="card flex cursor-pointer items-start text-left transition-colors"
              :class="
                selectedIds.includes(device.userId)
                  ? 'border-primary bg-surface-selected'
                  : 'border-stroke'
              "
            >
              <input
                type="checkbox"
                class="mt-1 h-5 w-5 flex-none accent-primary"
                :checked="selectedIds.includes(device.userId)"
                :aria-label="device.nick"
                @change="toggleDevice(device)"
              />
              <span class="ml-3 min-w-0 flex-1">
                <span class="block truncate text-body font-medium">{{ device.nick }}</span>
                <span class="mt-1 block truncate text-small text-text-secondary">
                  {{ t('device.model') }}: {{ device.product }}
                </span>
                <span class="mt-1 block break-all text-small text-text-secondary">
                  {{ t('device.deviceNumber') }}: {{ device.imei }}
                </span>
                <span class="mt-1 block break-all text-small text-text-secondary">
                  {{ t('device.iccid') }}: {{ device.iccid }}
                </span>
                <span class="mt-1 block text-small text-text-secondary">
                  {{ t('device.expireAt') }}: {{ device.expireAt }}
                </span>
              </span>
              <span class="ml-3 flex-none text-right text-small text-text-primary">
                <span class="block text-text-secondary">{{ t('device.price') }}</span>
                <span class="mt-1 block font-medium">{{ formatPrice(device.price) }}</span>
              </span>
            </label>
          </li>
        </ul>

        <footer class="mt-6 border-t border-stroke pt-4">
          <div class="flex items-center justify-between">
            <label class="flex min-h-11 items-center text-body">
              <input
                type="checkbox"
                class="h-5 w-5 flex-none accent-primary"
                :checked="allSelected"
                :aria-label="t('device.selectAll')"
                @change="toggleAll"
              />
              <span class="ml-2">{{ t('device.selectAll') }}</span>
            </label>
            <span class="text-body font-medium">
              {{ t('device.totalPrice') }}: {{ formatPrice(totalPrice) }}
            </span>
          </div>
          <button
            type="button"
            class="btn-primary mt-3 w-full"
            :disabled="selectedCount === 0"
            @click="openConfirmation"
          >
            {{ t('device.submitRecharge') }}
          </button>
        </footer>
      </QueryState>
    </main>

    <BaseModal
      v-if="confirming"
      :title="t('device.confirmRecharge')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="creatingOrder ? t('device.saving') : t('modal.confirm')"
      :dismissible="!creatingOrder"
      @cancel="confirming = false"
      @confirm="confirmRecharge"
    >
      {{
        t('device.batchRechargeConfirmMessage', {
          count: selectedCount,
          price: formatPrice(totalPrice),
        })
      }}
    </BaseModal>
  </div>
</template>
