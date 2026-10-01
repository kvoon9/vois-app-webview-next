<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { loginWithCredentials } from '@vois/webview-bridge/debug'
import { useQueryCache } from '@pinia/colada'
import PageHeader from '~/components/PageHeader.vue'
import LoginAccountInput from '~/components/login/LoginAccountInput.vue'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import { useToast } from '~/composables/useToast'
import { usePageBack } from '~/composables/usePageBack'
import { useCredentialSession } from '~/utils/auth'
import {
  ACCOUNT_COUNTRY_CODE,
  PHONE_COUNTRY_CODE,
  SAVED_LOGIN_CREDENTIALS_KEY,
} from '~/utils/auth/constants'
import type { SavedLoginCredentials } from '~/utils/auth/types'

/**
 * Signs in with an external account so a debug session runs as it. The native app
 * owns auth in production, and a browser cannot mint a token the `/v2` APIs accept,
 * so the page hands the credentials to the debug server, which signs in on the TCP
 * gateway. That is the same machinery `getDebugAccessToken` already reads.
 */
const loginEnabled = import.meta.env.DEV || isWebviewDebug()

const { t } = useI18n({ useScope: 'global' })
const { goBack } = usePageBack()
const queryCache = useQueryCache()
const { selectSession } = useCredentialSession()
const { showToast } = useToast()

const account = shallowRef('')
const password = shallowRef('')
const error = shallowRef('')
const submitting = shallowRef(false)
const accountHistory = useStorage<Record<string, string[]>>('vois-login-accounts', {}, undefined, {
  shallow: true,
  deep: false,
})
const savedCredentials = useStorage<SavedLoginCredentials[]>(
  SAVED_LOGIN_CREDENTIALS_KEY,
  [],
  undefined,
  { shallow: true, deep: false },
)
const savedAccounts = computed(() => [
  ...new Set([
    ...savedCredentials.value.map((saved) => saved.account),
    ...(accountHistory.value[ACCOUNT_COUNTRY_CODE] ?? []),
    ...(accountHistory.value[PHONE_COUNTRY_CODE] ?? []),
  ]),
])

account.value = savedCredentials.value[0]?.account ?? ''
watch(
  () => account.value.trim(),
  (name) => {
    password.value = savedCredentials.value.find((saved) => saved.account === name)?.password ?? ''
  },
  { immediate: true, flush: 'sync' },
)

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = ''

  if (!loginEnabled) {
    showToast(t('login.debugOnly'), { type: 'error' })
    return
  }

  const name = account.value.trim()
  if (name === '' || password.value === '') {
    error.value = t('validation.required')
    return
  }
  const code = /^1[3-9]\d{9}$/.test(name) ? PHONE_COUNTRY_CODE : ACCOUNT_COUNTRY_CODE
  const submittedPassword = password.value

  submitting.value = true
  try {
    const login = await loginWithCredentials({
      account: name,
      password: submittedPassword,
      countryCode: code,
    })
    selectSession(login)
    savedCredentials.value = [
      { account: name, password: submittedPassword },
      ...savedCredentials.value.filter((saved) => saved.account !== name),
    ].slice(0, 20)
    queryCache.cancelQueries()
    for (const entry of queryCache.getEntries()) queryCache.remove(entry)
    accountHistory.value = {
      ...accountHistory.value,
      [code]: [name, ...(accountHistory.value[code] ?? []).filter((saved) => saved !== name)].slice(
        0,
        10,
      ),
    }
    goBack()
  } catch (loginError) {
    error.value = loginError instanceof Error ? loginError.message : String(loginError)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('login.title')" />

    <main class="p-4">
      <form class="card space-y-4" novalidate @submit.prevent="submit()">
        <LoginAccountInput
          v-model="account"
          :label="t('login.accountOrPhone')"
          :accounts="savedAccounts"
          :disabled="submitting"
        />

        <label class="block">
          <span class="text-2nd-body">{{ t('login.password') }}</span>
          <input
            v-model="password"
            :disabled="submitting"
            type="password"
            autocomplete="current-password"
            class="input-field mt-2"
            :placeholder="t('login.password')"
          />
        </label>

        <p v-if="error" class="text-small text-danger">{{ error }}</p>

        <button type="submit" class="btn-primary" :disabled="submitting">
          {{ submitting ? t('login.submitting') : t('login.submit') }}
        </button>
      </form>
    </main>
  </div>
</template>
