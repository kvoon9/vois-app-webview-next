<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import Tag, { type TagTone } from '~/components/Tag.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseRouteParamId } from '~/composables/useRouteParamId'
import {
  getDeviceDetail,
  getRenewOrderRecords,
  type RenewChargeState,
  type RenewOrderRecord,
  type RenewPaymentKind,
  type RenewPaymentState,
} from '~/utils/device-api'

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

/** Payment kind → its label key; a new kind breaks typecheck here. */
const PAYMENT_KIND_KEYS = {
  unpaid: 'device.orderStatusUnpaid',
  paid: 'device.orderStatusPaid',
  closed: 'device.orderStatusClosed',
  expired: 'device.orderStatusExpired',
  timeout: 'device.orderStatusTimeout',
  error: 'device.orderStatusError',
} satisfies Record<RenewPaymentKind, string>

/** Payment kind → tag tone; every kind has a tone, including an unknown code. */
const PAYMENT_TONES = {
  unpaid: 'warning',
  paid: 'success',
  closed: 'neutral',
  expired: 'neutral',
  timeout: 'danger',
  error: 'danger',
  unknown: 'danger',
} satisfies Record<RenewPaymentState['kind'], TagTone>

/** Charge kind → tag tone. */
const CHARGE_TONES = {
  charged: 'success',
  uncharged: 'warning',
  unknown: 'danger',
} satisfies Record<RenewChargeState['kind'], TagTone>

/** The wire carries fen; the page shows yuan. */
function formatAmount(amount: number): string {
  return `¥${(amount / 100).toFixed(2)}`
}

function paymentStatusText(payment: RenewPaymentState): string {
  return payment.kind === 'unknown'
    ? t('device.orderStatusUnknown', { code: payment.code })
    : t(PAYMENT_KIND_KEYS[payment.kind])
}

function chargeStatusText(charge: RenewChargeState): string {
  switch (charge.kind) {
    case 'charged':
      return t('device.chargeStatusCharged')
    case 'uncharged':
      return t('device.chargeStatusUncharged')
    case 'unknown':
      return t('device.orderStatusUnknown', { code: charge.code })
  }
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
              <span class="min-w-0 flex-1 truncate text-title-compact font-medium">
                {{ record.orderDesc || t('device.renewOrderFallback') }}
              </span>
              <span class="ml-3 flex-none text-title-compact font-medium">
                {{ formatAmount(record.amount) }}
              </span>
            </div>
            <div class="mt-2 flex items-center justify-between text-body text-text-secondary">
              <span>{{ t('device.orderStatus') }}</span>
              <Tag
                :label="paymentStatusText(record.state.payment)"
                :tone="PAYMENT_TONES[record.state.payment.kind]"
              />
            </div>
            <div class="mt-1 flex items-center justify-between text-body text-text-secondary">
              <span>{{ t('device.chargeStatus') }}</span>
              <Tag
                :label="chargeStatusText(record.state.charge)"
                :tone="CHARGE_TONES[record.state.charge.kind]"
              />
            </div>
            <div class="mt-1 flex items-center justify-between text-body text-text-secondary">
              <span>{{ t('device.createdAt') }}</span>
              <time>{{ record.createdAt }}</time>
            </div>
            <div
              class="mt-1 flex flex-wrap items-start justify-between text-body text-text-secondary"
            >
              <span class="flex-none">{{ t('device.orderNumber') }}</span>
              <span class="ml-auto max-w-full flex-none break-all text-right">{{
                record.orderNo
              }}</span>
            </div>
            <div
              class="mt-1 flex flex-wrap items-start justify-between text-body text-text-secondary"
            >
              <span class="flex-none">{{ t('device.iccid') }}</span>
              <span class="ml-auto max-w-full flex-none break-all text-right">
                {{ record.iccid || t('device.notAvailable') }}
              </span>
            </div>
          </li>
        </ul>
      </QueryState>
    </main>
  </div>
</template>
