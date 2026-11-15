import { watch } from 'vue'
import { useQuery } from '@pinia/colada'
import { useAccountRegistry } from '~/composables/useAccountRegistry'
import { getAccountProfile } from '~/utils/account-api'
import { useCredentialSession } from '~/utils/auth'
import type { AccountProfile, CredentialSession, SavedAccount } from '~/utils/auth/types'
import { bridge } from '~/utils/bridge'

/** One finished profile read, tagged with the session that asked for it. */
export interface ProfileResult {
  selected: CredentialSession | null
  token: string
  profile: AccountProfile
}

/** The session a result must match, plus the writes a matching result may cause. */
export interface ProfileSink {
  session: CredentialSession | null
  rememberAccount: (account: SavedAccount, login: CredentialSession) => void
  selectSession: (login: CredentialSession) => void
}

/** Late profile responses may update only the session that requested them. */
export function applyProfileResult(
  result: ProfileResult | null | undefined,
  sink: ProfileSink,
): void {
  if (!result || result.selected !== sink.session) return
  const { profile, selected, token } = result
  const source = selected?.source ?? (selected ? 'credentials' : 'bridge')
  sink.rememberAccount(
    {
      key: `user:${profile.userId}`,
      ...profile,
      account: selected?.account,
      bridge: source === 'bridge',
    },
    { token, userId: profile.userId, account: selected?.account, source },
  )
  if (selected && selected.userId === undefined) {
    sink.selectSession({ ...selected, userId: profile.userId, source })
  }
}

/** Keeps the account registry's profile in sync with the selected session. */
export function useAccountProfile(): void {
  const { session, selectSession } = useCredentialSession()
  const { rememberAccount } = useAccountRegistry()
  const { state } = useQuery({
    key: () => ['account-profile', session.value?.userId ?? session.value?.account ?? 'bridge'],
    query: async () => {
      const selected = session.value
      const token = await bridge.getAccessToken()
      const profile = await getAccountProfile()
      if (selected?.userId !== undefined && selected.userId !== profile.userId) {
        throw new Error('帐号资料与当前登录会话不一致，请重试。')
      }
      return { selected, token, profile }
    },
  })

  watch(
    () => state.value.data,
    (result) => {
      applyProfileResult(result, { session: session.value, rememberAccount, selectSession })
    },
    { immediate: true },
  )
}
