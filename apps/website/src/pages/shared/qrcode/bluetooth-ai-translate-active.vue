<script setup lang="ts">
import { useMutation, useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '~/components/BaseModal.vue'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { usePageParams } from '~/composables/usePageParams'
import { useToast } from '~/composables/useToast'
import { accessToken } from '~/constants'
import {
  activateBluetoothCode,
  BLUETOOTH_ACTIVATED,
  BLUETOOTH_UNACTIVATED,
  getBluetoothCodeInfo,
  getOwnAccount,
  parseValidityPeriod,
  type BluetoothCodeInfo,
} from '~/utils/bluetooth-api'

const { t } = useI18n({ useScope: 'global' })
const { showToast } = useToast()
const queryCache = useQueryCache()
const confirming = shallowRef(false)

/** Native owns the params; only `uuid` is page-specific, the rest are defaults. */
const { params, settled, reload: reloadParams } = usePageParams([])

const uuid = computed(() => params.value.uuid ?? '')
const codeKey = computed(() => ['bluetooth-ai-translate', 'code', uuid.value])

const { state, refetch: reloadCode } = useQuery({
  key: codeKey,
  query: () => getBluetoothCodeInfo(uuid.value),
  // Auth, not the bridge, is what a request needs: the token arrives from
  // either the launch query or native, and the query starts as soon as it lands.
  enabled: () => Boolean(accessToken.value) && uuid.value !== '',
})

const { state: accountState } = useQuery({
  key: ['bluetooth-ai-translate', 'own-account'],
  query: getOwnAccount,
  enabled: () => Boolean(accessToken.value),
})

const info = computed(() => state.value.data ?? null)
const account = computed(() => accountState.value.data ?? null)
const activated = computed(() => info.value?.status === BLUETOOTH_ACTIVATED)
const unactivated = computed(() => info.value?.status === BLUETOOTH_UNACTIVATED)

/**
 * The one deadline a viewer acts on, so the same card reads correctly in both
 * states: before activation it is the last day to activate, afterwards what the
 * binding expires on.
 */
const deadline = computed<string | null>(() => {
  const code = info.value
  if (!code) return null
  if (code.status === BLUETOOTH_UNACTIVATED) {
    return t('bluetoothAiTranslateActive.activateBefore', { date: code.activeBefore })
  }
  if (code.status === BLUETOOTH_ACTIVATED && code.activeUser) {
    return t('bluetoothAiTranslateActive.expiresOn', { date: code.activeUser.expiryDate })
  }
  return null
})

/**
 * The page's own state on top of the query: a missing code and a missing token
 * are failures too, and a missing token is only one once native has answered.
 */
const viewStatus = computed<'pending' | 'error' | 'success'>(() => {
  if (!uuid.value) return 'error'
  if (!accessToken.value) return settled.value ? 'error' : 'pending'
  return state.value.status
})

const viewError = computed<Error | null>(() => {
  if (!uuid.value) return new Error(t('bluetoothAiTranslateActive.invalidUuid'))
  if (!accessToken.value) return new Error(t('bluetoothAiTranslateActive.noAuth'))
  return state.value.error ?? null
})

const { mutateAsync: activate, isLoading: activating } = useMutation({
  mutation: () => activateBluetoothCode(uuid.value),
})

/**
 * The backend sends a bare duration such as `12month`, with no locale of its own,
 * so the number is re-emitted through i18n. An unknown unit stays verbatim rather
 * than rendering a key the locale files may not have.
 */
const VALIDITY_UNIT_KEYS = new Map([
  ['day', 'validityDay'],
  ['month', 'validityMonth'],
  ['year', 'validityYear'],
])

function formatValidity(value: string): string {
  const period = parseValidityPeriod(value)
  const key = period && VALIDITY_UNIT_KEYS.get(period.unit)
  if (!period || !key) return value

  return t(`bluetoothAiTranslateActive.${key}`, period.count, { count: period.count })
}

async function confirmActivation(): Promise<void> {
  if (activating.value) return
  try {
    // `activate` already reads the activated info back; seeding the cache with it
    // keeps the page on one render instead of flashing a loading state.
    const activatedInfo: BluetoothCodeInfo = await activate()
    queryCache.setQueryData(codeKey.value, activatedInfo)
    confirming.value = false
    showToast(t('bluetoothAiTranslateActive.activateSuccess'))
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), { type: 'error' })
  }
}

function retry(): void {
  void reloadParams()
  void reloadCode()
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('bluetoothAiTranslateActive.title')" />

    <main class="p-4">
      <QueryState :status="viewStatus" :error="viewError" @retry="retry">
        <template v-if="info">
          <h2 class="px-1 section-title">{{ info.name }}</h2>
          <p class="mt-1 px-1 text-2nd-body text-text-secondary">
            {{ t('bluetoothAiTranslateActive.validityPeriod') }}
            {{ formatValidity(info.validityPeriod) }}
          </p>

          <div v-if="activated || unactivated" class="mt-4 panel px-4 py-3">
            <p
              class="text-header font-medium"
              :class="activated ? 'text-primary' : 'text-text-primary'"
            >
              {{
                t(
                  activated
                    ? 'bluetoothAiTranslateActive.activated'
                    : 'bluetoothAiTranslateActive.unactivated',
                )
              }}
            </p>
            <p v-if="deadline" class="mt-1 text-2nd-body text-text-secondary">{{ deadline }}</p>
          </div>

          <p v-else class="mt-4 px-1 text-body text-text-secondary" role="alert">
            {{ t('bluetoothAiTranslateActive.unknownStatus') }}
          </p>

          <button
            v-if="unactivated"
            type="button"
            class="btn-primary mt-4"
            :disabled="activating"
            @click="confirming = true"
          >
            {{
              activating
                ? t('bluetoothAiTranslateActive.activating')
                : t('bluetoothAiTranslateActive.activate')
            }}
          </button>

          <template v-if="activated && info.activeUser">
            <p class="mt-6 px-1 text-2nd-body text-text-secondary">
              {{ t('bluetoothAiTranslateActive.boundAccount') }}
            </p>
            <dl class="mt-2 overflow-hidden panel">
              <div class="flex items-center justify-between px-4 py-3">
                <dt class="text-2nd-body text-text-secondary">
                  {{ t('bluetoothAiTranslateActive.number') }}
                </dt>
                <dd class="ml-4 text-right text-2nd-body">{{ info.activeUser.number }}</dd>
              </div>
              <div class="flex items-center justify-between px-4 py-3">
                <dt class="text-2nd-body text-text-secondary">
                  {{ t('bluetoothAiTranslateActive.nick') }}
                </dt>
                <dd class="ml-4 min-w-0 truncate text-right text-2nd-body">
                  {{ info.activeUser.nick }}
                </dd>
              </div>
            </dl>
          </template>

          <p class="mt-6 px-1 text-small text-text-secondary">
            {{ t('bluetoothAiTranslateActive.code') }}
          </p>
          <p class="mt-1 px-1 text-small break-all text-text-secondary">{{ info.uuid }}</p>
        </template>
      </QueryState>
    </main>

    <BaseModal
      v-if="confirming"
      :title="t('bluetoothAiTranslateActive.confirmTitle')"
      :cancel-text="t('modal.cancel')"
      :confirm-text="activating ? t('bluetoothAiTranslateActive.activating') : t('modal.confirm')"
      :dismissible="!activating"
      @cancel="confirming = false"
      @confirm="confirmActivation"
    >
      <p class="text-2nd-body text-danger">{{ t('bluetoothAiTranslateActive.confirmWarning') }}</p>

      <h3 class="mt-4 text-2nd-body text-text-secondary">
        {{ t('bluetoothAiTranslateActive.boundAccount') }}
      </h3>
      <dl class="mt-2 overflow-hidden panel">
        <div class="flex items-center justify-between px-4 py-3">
          <dt class="text-2nd-body text-text-secondary">
            {{ t('bluetoothAiTranslateActive.number') }}
          </dt>
          <dd class="ml-4 text-right text-2nd-body">
            {{ account?.num ?? t('translation.loading') }}
          </dd>
        </div>
        <div class="flex items-center justify-between px-4 py-3">
          <dt class="text-2nd-body text-text-secondary">
            {{ t('bluetoothAiTranslateActive.nick') }}
          </dt>
          <dd class="ml-4 min-w-0 truncate text-right text-2nd-body">
            {{ account?.nick ?? t('translation.loading') }}
          </dd>
        </div>
      </dl>
    </BaseModal>
  </div>
</template>
