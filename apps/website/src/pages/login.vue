<script setup lang="ts">
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { loginWithCredentials } from '@vois/webview-bridge/debug'
import PageHeader from '~/components/PageHeader.vue'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import { useToast } from '~/composables/useToast'

/**
 * Signs in with an external account so a debug session runs as it. The native app
 * owns auth in production, and a browser cannot mint a token the `/v2` APIs accept,
 * so the page hands the credentials to the debug server, which signs in on the TCP
 * gateway. That is the same machinery `getDebugAccessToken` already reads.
 */
const loginEnabled = import.meta.env.DEV || isWebviewDebug()

type LoginMode = 'account' | 'phone'
// '0' is the wire format's Weila-number country code; a phone number dials with its real code.
const WEILA_COUNTRY_CODE = '0'

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const { showToast } = useToast()

const mode = shallowRef<LoginMode>('account')
const account = shallowRef('')
const countryCode = shallowRef('86')
const password = shallowRef('')
const error = shallowRef('')
const submitting = shallowRef(false)

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
  const code = mode.value === 'phone' ? countryCode.value.trim() : WEILA_COUNTRY_CODE
  if (code === '') {
    error.value = t('validation.required')
    return
  }

  submitting.value = true
  try {
    // The server adopts the account: its token serves every later
    // `getDebugAccessToken`, and the bridge answers the account's `login-id`.
    await loginWithCredentials({
      account: name,
      password: password.value,
      countryCode: code,
    })
    await router.replace('/')
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
      <div class="flex mb-4" :aria-label="t('login.title')">
        <button
          type="button"
          class="chip flex-1 mr-3"
          :class="mode === 'account' ? 'chip-selected' : 'chip-unselected'"
          :aria-pressed="mode === 'account'"
          @click="mode = 'account'"
        >
          {{ t('login.accountMode') }}
        </button>
        <button
          type="button"
          class="chip flex-1"
          :class="mode === 'phone' ? 'chip-selected' : 'chip-unselected'"
          :aria-pressed="mode === 'phone'"
          @click="mode = 'phone'"
        >
          {{ t('login.phoneMode') }}
        </button>
      </div>

      <form class="card space-y-4" novalidate @submit.prevent="submit()">
        <label v-if="mode === 'phone'" class="block">
          <span class="text-2nd-body">{{ t('login.countryCode') }}</span>
          <input
            v-model="countryCode"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            class="input-field mt-2"
            :placeholder="t('login.countryCode')"
          />
        </label>

        <label class="block">
          <span class="text-2nd-body">{{
            mode === 'phone' ? t('login.phone') : t('login.account')
          }}</span>
          <input
            v-model="account"
            type="text"
            :inputmode="mode === 'phone' ? 'tel' : 'text'"
            autocomplete="username"
            class="input-field mt-2"
            :placeholder="mode === 'phone' ? t('login.phone') : t('login.account')"
          />
        </label>

        <label class="block">
          <span class="text-2nd-body">{{ t('login.password') }}</span>
          <input
            v-model="password"
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
