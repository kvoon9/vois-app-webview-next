<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import { getDeviceDetail, getRenewOrderRecords, type RenewOrderRecord } from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const deviceId = computed(() => parseRouteParamId(route.params.id))

const { state, refetch: reload } = useQuery({
  key: ['device-management', 'renew-order-records'],
  query: getRenewOrderRecords,
})

// Records are account wide; when the device profile loads they narrow to that
// device's card. A device without a card, or a failed profile read, keeps the
// full list instead of blocking the page.
const { state: deviceState } = useQuery({
  key: () => ['device-management', 'device', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return getDeviceDetail(deviceId.value)
  },
})

const records = computed<RenewOrderRecord[]>(() => state.value.data ?? [])
const simIccid = computed(() => deviceState.value.data?.simCard?.iccid ?? null)
const filteredRecords = computed(() =>
  simIccid.value
    ? records.value.filter((record) => record.iccid === simIccid.value)
    : records.value,
)

/** The wire carries fen; the page shows yuan. */
function formatAmount(amount: number): string {
  return `¥${(amount / 100).toFixed(2)}`
}

// The wire carries numbers; 1 marks the paid and charged states.
function statusLabel(status: number): string {
  return status === 1 ? t('device.orderStatusPaid') : t('device.orderStatusUnpaid')
}

function chargeStatusLabel(chargeStatus: number): string {
  return chargeStatus === 1 ? t('device.chargeStatusCharged') : t('device.chargeStatusUncharged')
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('device.rechargeRecords')" />
    <main class="p-4">
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.status === 'success' && filteredRecords.length === 0"
        :empty-text="t('device.emptyRechargeRecords')"
        @retry="reload()"
      >
        <ul class="space-y-3">
          <li v-for="record in filteredRecords" :key="record.orderNo" class="card">
            <div class="flex items-center justify-between">
              <span class="min-w-0 flex-1 truncate text-body font-medium">
                {{ record.orderDesc }}
              </span>
              <span class="ml-3 flex-none text-body font-medium">
                {{ formatAmount(record.amount) }}
              </span>
            </div>
            <div class="mt-2 flex items-center justify-between text-small text-text-secondary">
              <span>{{ t('device.orderStatus') }}: {{ statusLabel(record.status) }}</span>
              <time>{{ record.createdAt }}</time>
            </div>
            <div class="mt-1 flex items-start justify-between text-small text-text-secondary">
              <span class="min-w-0 break-all">
                {{ t('device.orderNumber', { id: record.orderNo }) }}
              </span>
              <span class="ml-3 flex-none">{{ chargeStatusLabel(record.chargeStatus) }}</span>
            </div>
          </li>
        </ul>
      </QueryState>
    </main>
  </div>
</template>
