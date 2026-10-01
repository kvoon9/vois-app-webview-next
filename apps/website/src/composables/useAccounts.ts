import { useQueryCache } from '@pinia/colada'
import { loginWithCredentials } from '@vois/webview-bridge/debug'
import { useCredentialSession } from '~/utils/auth'
import { useAccountRegistry } from '~/composables/useAccountRegistry'
import { ACCOUNT_COUNTRY_CODE, PHONE_COUNTRY_CODE } from '~/utils/auth/constants'
import type { SavedAccount } from '~/utils/auth/types'

export function useAccounts() {
  const { savedCredentials, accounts, sessions, currentKey, rememberAccount } = useAccountRegistry()
  const { session, selectSession } = useCredentialSession()
  const queryCache = useQueryCache()

  async function signIn(account: string, password: string): Promise<void> {
    const countryCode = /^1[3-9]\d{9}$/.test(account) ? PHONE_COUNTRY_CODE : ACCOUNT_COUNTRY_CODE
    const login = await loginWithCredentials({ account, password, countryCode })
    const selected = { ...login, account, source: 'credentials' as const }
    const existing = accounts.value.find(
      (saved) =>
        saved.account === account || (login.userId !== undefined && saved.userId === login.userId),
    )
    selectSession(selected)
    rememberAccount(
      {
        key: login.userId === undefined ? `credentials:${account}` : `user:${login.userId}`,
        userId: login.userId,
        account,
        num: existing?.num ?? '',
        nick: existing?.nick ?? '',
        avatar: existing?.avatar ?? '',
        bridge: false,
      },
      selected,
    )
    savedCredentials.value = [
      { account, password, userId: login.userId },
      ...savedCredentials.value.filter((saved) => saved.account !== account),
    ].slice(0, 20)
    clearQueries()
  }

  function clearQueries(): void {
    queryCache.cancelQueries()
    for (const entry of queryCache.getEntries()) queryCache.remove(entry)
  }

  async function selectAccount(account: SavedAccount): Promise<void> {
    const credentials = savedCredentials.value.find((saved) => saved.account === account.account)
    if (credentials) {
      await signIn(credentials.account, credentials.password)
      return
    }
    const cached = sessions.value[account.key]
    if (!cached) throw new Error('登录信息已失效，请重新添加帐号。')
    selectSession(cached)
    clearQueries()
  }

  return { savedCredentials, accounts, sessions, currentKey, session, signIn, selectAccount }
}
