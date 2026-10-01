<script setup lang="ts">
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import Avatar from '~/components/Avatar.vue'
import { useAccounts } from '~/composables/useAccounts'
import type { SavedAccount } from '~/utils/auth/types'

defineProps<{ canAddAccount: boolean }>()

const { t } = useI18n({ useScope: 'global' })
const { accounts, sessions, currentKey, selectAccount } = useAccounts()
const switchingAccount = shallowRef('')
const error = shallowRef('')

async function switchAccount(account: SavedAccount): Promise<void> {
  if (switchingAccount.value || currentKey.value === account.key) return
  switchingAccount.value = account.key
  error.value = ''
  try {
    await selectAccount(account)
  } catch (loginError) {
    error.value = loginError instanceof Error ? loginError.message : String(loginError)
  } finally {
    switchingAccount.value = ''
  }
}
</script>

<template>
  <section class="mb-6 space-y-3" :aria-label="t('login.savedAccounts')">
    <template v-if="accounts.length">
      <h2 class="text-2nd-body text-text-secondary">{{ t('login.savedAccounts') }}</h2>
      <ul class="space-y-2" :aria-busy="Boolean(switchingAccount)">
        <li v-for="saved in accounts" :key="saved.key">
          <button
            type="button"
            class="nav-item min-h-12 w-full disabled:opacity-60"
            :class="{ 'bg-surface-selected': currentKey === saved.key }"
            :aria-pressed="currentKey === saved.key"
            :disabled="Boolean(switchingAccount) || (!saved.account && !sessions[saved.key])"
            @click="switchAccount(saved)"
          >
            <Avatar :name="saved.nick || saved.account || saved.num" :src="saved.avatar" />
            <span class="ml-3 min-w-0 flex-1 text-left">
              <span class="block truncate">{{ saved.nick || saved.account || saved.num }}</span>
              <span class="block truncate text-small text-text-secondary">
                {{ saved.num || saved.account }}
                <span v-if="saved.bridge" class="ml-2">{{ t('login.appAccount') }}</span>
              </span>
            </span>
            <span v-if="switchingAccount === saved.key" class="ml-3 text-small text-text-secondary">
              {{ t('login.switching') }}
            </span>
            <span v-else-if="currentKey === saved.key" class="ml-3 text-small text-primary">
              {{ t('login.currentAccount') }}
            </span>
            <span
              v-else-if="!saved.account && !sessions[saved.key]"
              class="ml-3 text-small text-text-secondary"
            >
              {{ t('login.sessionExpired') }}
            </span>
            <span v-else class="row-chevron ml-3" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <p v-if="error" role="alert" class="text-small text-danger">{{ error }}</p>
    </template>
    <RouterLink v-if="canAddAccount" to="/login" class="btn-primary">{{
      t('login.addAccount')
    }}</RouterLink>
  </section>
</template>
