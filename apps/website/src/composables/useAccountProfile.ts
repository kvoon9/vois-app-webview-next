import { watch } from 'vue'
import { useQuery } from '@pinia/colada'
import { useAccountRegistry } from '~/composables/useAccountRegistry'
import { i18n } from '~/i18n'
import { getAccountProfile } from '~/utils/account-api'
import { useCredentialSession } from '~/utils/auth'
import { bridge } from '~/utils/bridge'

/** Late profile responses may update only the session that requested them. */
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
        throw new Error(i18n.global.t('account.profileMismatch'))
      }
      return { selected, token, profile }
    },
  })

  watch(
    () => state.value.data,
    (result) => {
      if (!result || result.selected !== session.value) return
      const { profile, selected, token } = result
      const source = selected?.source ?? (selected ? 'credentials' : 'bridge')
      rememberAccount(
        {
          key: `user:${profile.userId}`,
          ...profile,
          account: selected?.account,
          bridge: source === 'bridge',
        },
        { token, userId: profile.userId, account: selected?.account, source },
      )
      if (selected && selected.userId === undefined) {
        selectSession({ ...selected, userId: profile.userId, source })
      }
    },
    { immediate: true },
  )
}
