<script setup lang="ts">
import { isSupportBridge } from '@vois/webview-bridge'
import { computed, onMounted, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageHeader from '~/components/PageHeader.vue'
import { whenWebviewBridge } from '~/composables/useWebviewBridge'
import {
  fetchPageParams,
  objectRows,
  queryRows,
  type PageParamsBridgeSource,
  type PageParamsOutcome,
} from '~/utils/page-params'

const { t } = useI18n()
const route = useRoute()

const query = computed(() => queryRows(route.query))

/** What native returns. The wire carries values, so the page declares the types. */
interface BluetoothAiTranslateParams {
  uuid: string
  'access-token': string
}

/**
 * Names to ask native for. Typed against the interface above so a rename in one
 * place cannot silently leave the request asking for a field nobody reads.
 */
const WANTED_PARAMS: readonly (keyof BluetoothAiTranslateParams)[] = ['uuid', 'access-token']

/** Native owns the params; this page only renders whatever it sends back. */
const nativeSource: PageParamsBridgeSource = {
  supported: isSupportBridge(),
  whenReady: whenWebviewBridge,
}

const outcome = shallowRef<PageParamsOutcome<BluetoothAiTranslateParams> | { status: 'loading' }>({
  status: 'loading',
})

const params = computed(() => {
  const current = outcome.value
  return current.status === 'ok' ? objectRows(current.response.data) : []
})

onMounted(async () => {
  outcome.value = { status: 'loading' }
  outcome.value = await fetchPageParams<BluetoothAiTranslateParams>(
    nativeSource,
    route.path,
    WANTED_PARAMS,
  )
})
</script>

<template>
  <div class="page">
    <PageHeader :title="t('bluetoothAiTranslateActive.title')" />

    <main class="p-4 space-y-4">
      <section>
        <h2 class="section-title px-1">{{ t('bluetoothAiTranslateActive.queryTitle') }}</h2>
        <div class="mt-2 card">
          <p v-if="query.length === 0" class="text-body text-text-secondary">
            {{ t('bluetoothAiTranslateActive.emptyQuery') }}
          </p>
          <dl v-else class="space-y-2">
            <div v-for="row in query" :key="row.key" class="flex items-baseline justify-between">
              <dt class="flex-none text-2nd-body text-text-secondary">{{ row.key }}</dt>
              <dd class="ml-3 min-w-0 break-all text-right text-2nd-body">
                {{ row.value }}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <h2 class="section-title px-1">{{ t('bluetoothAiTranslateActive.paramsTitle') }}</h2>
        <div class="mt-2 card">
          <p v-if="outcome.status === 'loading'" class="text-body text-text-secondary">
            {{ t('translation.loading') }}
          </p>
          <p v-else-if="outcome.status === 'unsupported'" class="text-body text-text-secondary">
            {{ t('bluetoothAiTranslateActive.unsupported') }}
          </p>
          <p v-else-if="outcome.status === 'failed'" class="text-body text-text-secondary">
            {{ t('bluetoothAiTranslateActive.failed') }}
          </p>
          <p
            v-if="outcome.status === 'failed' && outcome.detail"
            class="mt-1 break-all text-small text-text-secondary"
          >
            {{ outcome.detail }}
          </p>
          <p v-else-if="params.length === 0" class="text-body text-text-secondary">
            {{ t('bluetoothAiTranslateActive.emptyParams') }}
          </p>
          <dl v-else class="space-y-2">
            <div v-for="row in params" :key="row.key" class="flex items-baseline justify-between">
              <dt class="flex-none text-2nd-body text-text-secondary">{{ row.key }}</dt>
              <dd class="ml-3 min-w-0 break-all text-right text-2nd-body">
                {{ row.value }}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  </div>
</template>
