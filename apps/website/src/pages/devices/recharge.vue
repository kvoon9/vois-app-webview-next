<script setup lang="ts">
import { useMutation, useQuery } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { usePageParams } from '~/composables/usePageParams'
import { useToast } from '~/composables/useToast'
import {
  createRenewOrder,
  getRenewSimCards,
  type RenewOrderResult,
  type RenewSimCard,
} from '~/utils/device-api'

/** One order the page created: the card it belongs to plus the server's answer. */
interface PlacedOrder {
  card: RenewSimCard
  order: RenewOrderResult
}

const { t } = useI18n({ useScope: 'global' })
const { showToast } = useToast()
const { params } = usePageParams(['pay-method', 'pkg-name'])

// Native passes the pay method and bundle id in; the defaults keep the browser
// preview and any non-app host working without them.
const payMethod = computed(() => params.value['pay-method'] ?? 'wechat')
const pkgName = computed(() => params.value['pkg-name'] ?? 'com.voistech.weila')

const selectedIccids = shallowRef<string[]>([])
const confirming = shallowRef(false)
const resultOpen = shallowRef(false)
const placedOrders = shallowRef<PlacedOrder[]>([])

const { state, refetch: reload } = useQuery({
  key: ['device-management', 'renew-sim-cards'],
  query: getRenewSimCards,
})

const cards = computed(() => state.value.data ?? [])
const selectedCards = computed(() =>
  cards.value.filter((card) => selectedIccids.value.includes(card.iccid)),
)
const selectedCount = computed(() => selectedCards.value.length)
const allSelected = computed(
  () => cards.value.length > 0 && selectedCount.value === cards.value.length,
)

const { mutateAsync: createOrders, isLoading: creatingOrders } = useMutation({
  // The renewal endpoint takes a single iccid, so one card means one order.
  mutation: async (selected: readonly RenewSimCard[]): Promise<PlacedOrder[]> => {
    const placed: PlacedOrder[] = []
    for (const card of selected) {
      const order = await createRenewOrder({
        iccid: card.iccid,
        payMethod: payMethod.value,
        pkgName: pkgName.value,
      })
      placed.push({ card, order })
    }
    return placed
  },
})

/** The wire carries fen; the page shows yuan. */
function formatAmount(amount: number): string {
  return `¥${(amount / 100).toFixed(2)}`
}

function toggleCard(card: RenewSimCard): void {
  selectedIccids.value = selectedIccids.value.includes(card.iccid)
    ? selectedIccids.value.filter((iccid) => iccid !== card.iccid)
    : [...selectedIccids.value, card.iccid]
}

function toggleAll(): void {
  selectedIccids.value = allSelected.value ? [] : cards.value.map((card) => card.iccid)
}

function openConfirmation(): void {
  if (selectedCount.value > 0) confirming.value = true
}

async function confirmRecharge(): Promise<void> {
  if (selectedCount.value === 0 || creatingOrders.value) return
  try {
    placedOrders.value = await createOrders(selectedCards.value)
    confirming.value = false
    selectedIccids.value = []
    void reload()
    resultOpen.value = true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    showToast(message === '' ? t('device.renewOrderFailed') : message, { type: 'error' })
  }
}
</script>

<template>
  <div class="page">
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
          <li v-for="card in cards" :key="card.iccid">
            <label
              class="rounded-standard flex cursor-pointer items-start p-4 text-left transition-colors"
              :class="
                selectedIccids.includes(card.iccid) ? 'bg-surface-selected' : 'bg-surface-elevated'
              "
            >
              <input
                type="checkbox"
                class="mt-1 h-5 w-5 flex-none accent-primary"
                :checked="selectedIccids.includes(card.iccid)"
                :aria-label="card.userNick"
                @change="toggleCard(card)"
              />
              <span class="ml-3 min-w-0 flex-1">
                <span class="block truncate text-body font-medium">{{ card.userNick }}</span>
                <span class="mt-1 block truncate text-small text-text-secondary">
                  {{ t('device.model') }}: {{ card.product }}
                </span>
                <span class="mt-1 block truncate text-small text-text-secondary">
                  {{ t('device.userNumber') }}: {{ card.userNum }}
                </span>
                <span class="mt-1 block text-small text-text-secondary">
                  {{ t('device.expireAt') }}: {{ card.expiryDate }}
                </span>
              </span>
            </label>
          </li>
        </ul>

        <footer class="mt-6 pt-4">
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
      :confirm-text="creatingOrders ? t('device.renewOrderCreating') : t('modal.confirm')"
      :dismissible="!creatingOrders"
      @cancel="confirming = false"
      @confirm="confirmRecharge"
    >
      {{ t('device.renewConfirmMessage', { count: selectedCount }) }}
    </BaseModal>

    <BaseModal
      v-if="resultOpen"
      :title="t('device.rechargeSuccess')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="t('modal.confirm')"
      @cancel="resultOpen = false"
      @confirm="resultOpen = false"
    >
      <p class="text-body text-danger">{{ t('device.renewPayInApp') }}</p>
      <ul class="mt-3 space-y-3">
        <li
          v-for="placed in placedOrders"
          :key="placed.order.orderNo"
          class="rounded-standard bg-surface-field p-3"
        >
          <div class="flex items-center justify-between">
            <span class="min-w-0 flex-1 truncate text-body font-medium">
              {{ placed.card.userNick }}
            </span>
            <span class="ml-3 flex-none text-body font-medium">
              {{ formatAmount(placed.order.amount) }}
            </span>
          </div>
          <p class="mt-1 truncate text-small text-text-secondary">
            {{ t('device.product') }}: {{ placed.order.productName }}
          </p>
          <p class="mt-1 break-all text-small text-text-secondary">
            {{ t('device.orderNumber', { id: placed.order.orderNo }) }}
          </p>
        </li>
      </ul>
    </BaseModal>
  </div>
</template>
