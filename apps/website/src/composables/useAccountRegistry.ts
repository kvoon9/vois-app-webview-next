import { computed } from 'vue'
import { createGlobalState, useSessionStorage, useStorage } from '@vueuse/core'
import { useCredentialSession } from '~/utils/auth'
import { mergeAccount } from '~/utils/auth/accounts'
import {
  ACCOUNT_SESSIONS_KEY,
  BRIDGE_ACCOUNT_KEY,
  SAVED_ACCOUNTS_KEY,
  SAVED_LOGIN_CREDENTIALS_KEY,
} from '~/utils/auth/constants'
import type { CredentialSession, SavedAccount, SavedLoginCredentials } from '~/utils/auth/types'

export const useAccountRegistry = createGlobalState(() => {
  const savedCredentials = useStorage<SavedLoginCredentials[]>(
    SAVED_LOGIN_CREDENTIALS_KEY,
    [],
    undefined,
    { shallow: true, deep: false },
  )
  const profiles = useStorage<SavedAccount[]>(SAVED_ACCOUNTS_KEY, [], undefined, {
    shallow: true,
    deep: false,
  })
  const sessions = useSessionStorage<Record<string, CredentialSession>>(
    ACCOUNT_SESSIONS_KEY,
    {},
    {
      shallow: true,
      deep: false,
    },
  )
  const bridgeAccountKey = useSessionStorage(BRIDGE_ACCOUNT_KEY, '', { shallow: true, deep: false })
  const { session } = useCredentialSession()
  const currentKey = computed(() => {
    if (session.value?.userId !== undefined) return `user:${session.value.userId}`
    if (session.value?.account) return `credentials:${session.value.account}`
    return bridgeAccountKey.value
  })
  const accounts = computed(() => {
    const legacyAccounts = savedCredentials.value.map((saved): SavedAccount => ({
      key: saved.userId === undefined ? `credentials:${saved.account}` : `user:${saved.userId}`,
      userId: saved.userId,
      account: saved.account,
      num: '',
      nick: '',
      avatar: '',
      bridge: false,
    }))
    return profiles.value.reduceRight(mergeAccount, legacyAccounts)
  })

  function rememberAccount(account: SavedAccount, login: CredentialSession): void {
    profiles.value = mergeAccount(profiles.value, account)
    sessions.value = { ...sessions.value, [account.key]: login }
    if (login.source === 'bridge') bridgeAccountKey.value = account.key
  }

  return { savedCredentials, accounts, sessions, currentKey, rememberAccount }
})
