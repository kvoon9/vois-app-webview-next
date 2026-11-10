<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { usePageParams } from '~/composables/usePageParams'
import { renewPayParams, useWechatRenewPayment } from '~/composables/useWechatRenewPayment'
import { getRenewSimCards, type RenewSimCard } from '~/utils/device-api'

const { t } = useI18n({ useScope: 'global' })
const { params } = usePageParams(['pay-method', 'pkg-name', 'wxpay-appid'])

const payParams = computed(() => renewPayParams(params.value))

const { state, refetch: reload } = useQuery({
  key: ['device-management', 'renew-sim-cards'],
  query: getRenewSimCards,
})

const payment = useWechatRenewPayment({
  payMethod: 'wechat',
  pkgName: () => payParams.value.pkgName,
  wxpayAppId: () => payParams.value.wxpayAppId,
  onPaid: () => reload(),
})

const payState = payment.state
/** Closing the paying dialog only hides it; the bridge result still lands. */
const payingHidden = shallowRef(false)
const confirmingOrder = computed(() =>
  payState.value.kind === 'confirming' ? payState.value.order : null,
)
const payingOrder = computed(() => (payState.value.kind === 'paying' ? payState.value.order : null))
const successPayment = computed(() => (payState.value.kind === 'success' ? payState.value : null))
const failedPayment = computed(() => (payState.value.kind === 'failed' ? payState.value : null))
const failedTitle = computed(() =>
  failedPayment.value?.order === null ? t('device.orderFailed') : t('device.payStatusFailed'),
)
const busy = computed(() => payState.value.kind === 'creating' || payState.value.kind === 'paying')

/** The wire carries fen; the payment dialog shows yuan. */
function formatAmount(amount: number): string {
  return `¥${(amount / 100).toFixed(2)}`
}

async function startRenew(card: RenewSimCard): Promise<void> {
  if (busy.value) return
  payingHidden.value = false
  await payment.start(card.iccid)
}

async function confirmPay(): Promise<void> {
  const order = confirmingOrder.value
  if (!order) return
  payingHidden.value = false
  await payment.payOrder(order)
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('device.rechargeDevices')" />

    <main class="p-4">
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.data?.length === 0"
        :empty-text="t('device.emptyRechargeDevices')"
        @retry="reload()"
      >
        <ul class="space-y-3">
          <li
            v-for="card in state.data"
            :key="card.iccid"
            class="rounded-standard bg-surface-elevated p-4"
          >
            <div class="flex items-start justify-between space-x-3">
              <div class="min-w-0 flex-1">
                <p class="truncate text-body font-medium">{{ card.userNick }}</p>
                <p class="mt-1 truncate text-small text-text-secondary">
                  {{ t('device.model') }}: {{ card.product }}
                </p>
                <p class="mt-1 truncate text-small text-text-secondary">
                  {{ t('device.userNumber') }}: {{ card.userNum }}
                </p>
                <p class="mt-1 text-small text-text-secondary">
                  {{ t('device.expireAt') }}: {{ card.expiryDate }}
                </p>
              </div>
              <button
                type="button"
                class="ml-3 inline-flex h-11 flex-none items-center text-small font-medium text-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                :disabled="busy"
                @click="startRenew(card)"
              >
                {{ t('device.renewNow') }}
              </button>
            </div>
          </li>
        </ul>
      </QueryState>
    </main>

    <BaseModal
      v-if="confirmingOrder"
      :title="t('device.confirmPay')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="t('device.payNow')"
      @cancel="payment.reset()"
      @confirm="confirmPay"
    >
      <div class="text-center">
        <p class="text-body font-medium">{{ confirmingOrder.productName }}</p>
        <p class="mt-1 text-small text-text-secondary">{{ confirmingOrder.productDesc }}</p>
        <p class="mt-4 text-small text-text-secondary">{{ t('device.payAmount') }}</p>
        <p class="mt-1 text-title font-semibold text-primary">
          {{ formatAmount(confirmingOrder.amount) }}
        </p>
      </div>
    </BaseModal>

    <BaseModal
      v-if="payingOrder && !payingHidden"
      :title="t('device.payStatusPaying')"
      @cancel="payingHidden = true"
    >
      <div class="text-center">
        <p class="text-body font-medium">{{ payingOrder.productName }}</p>
        <p class="mt-1 text-title font-semibold">{{ formatAmount(payingOrder.amount) }}</p>
      </div>
      <template #footer>
        <div class="space-y-3">
          <p class="text-center text-small text-text-secondary">{{ t('device.payingHint') }}</p>
          <button
            type="button"
            class="modal-action w-full bg-surface-field text-text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            @click="payingHidden = true"
          >
            {{ t('modal.close') }}
          </button>
        </div>
      </template>
    </BaseModal>

    <BaseModal v-if="successPayment" :title="t('device.paySuccess')">
      <div class="text-center">
        <p class="text-body font-medium">{{ successPayment.order.productName }}</p>
        <p class="mt-1 text-title font-semibold">
          {{ formatAmount(successPayment.order.amount) }}
        </p>
        <p v-if="!successPayment.serverConfirmed" class="mt-3 text-small text-danger">
          {{ t('device.payUnconfirmed') }}
        </p>
      </div>
      <template #footer>
        <div class="flex">
          <button
            type="button"
            class="modal-action bg-primary text-primary-text focus-visible:ring-2 focus-visible:ring-primary/40"
            @click="payment.reset()"
          >
            {{ t('modal.ok') }}
          </button>
        </div>
      </template>
    </BaseModal>

    <BaseModal
      v-if="failedPayment"
      :title="failedTitle"
      :cancel-text="t('modal.close')"
      :confirm-text="failedPayment.canRetry ? t('device.payRetry') : t('modal.ok')"
      @cancel="payment.reset()"
      @confirm="failedPayment.canRetry ? payment.retry() : payment.reset()"
    >
      <p class="text-center text-body [text-wrap:balance]">{{ failedPayment.message }}</p>
      <template v-if="!failedPayment.canRetry" #footer>
        <div class="flex">
          <button
            type="button"
            class="modal-action bg-primary text-primary-text focus-visible:ring-2 focus-visible:ring-primary/40"
            @click="payment.reset()"
          >
            {{ t('modal.ok') }}
          </button>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
