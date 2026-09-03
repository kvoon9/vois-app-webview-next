<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { getRechargeRecords, type RechargeRecord } from '~/utils/device-api'

type RouteParam = string | string[] | undefined

function routeNumber(value: RouteParam): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.trim() === '') return null
  const number = Number(raw)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const deviceId = computed(() => routeNumber(route.params.id))

const { state, refetch: reload } = useQuery({
  key: () => ['device-management', 'recharge-records', deviceId.value],
  query: () => {
    if (deviceId.value == null) throw new Error(t('device.invalidId'))
    return getRechargeRecords(deviceId.value)
  },
})

const records = computed<RechargeRecord[]>(() => state.value.data ?? [])
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('device.rechargeRecords')" />
    <main class="p-4">
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="state.status === 'success' && records.length === 0"
        :empty-text="t('device.emptyRechargeRecords')"
        @retry="reload()"
      >
        <ul class="space-y-3">
          <li v-for="record in records" :key="record.orderId" class="card">
            <div class="flex items-center justify-between">
              <span class="text-body font-medium">
                {{ t('device.orderNumber', { id: record.orderId }) }}
              </span>
              <span class="text-body font-medium">¥{{ record.amount.toFixed(2) }}</span>
            </div>
            <div class="mt-2 flex items-center justify-between text-small text-text-secondary">
              <span>{{ t('device.orderStatus') }}: {{ record.status }}</span>
              <time>{{ record.createdAt }}</time>
            </div>
          </li>
        </ul>
      </QueryState>
    </main>
  </div>
</template>
