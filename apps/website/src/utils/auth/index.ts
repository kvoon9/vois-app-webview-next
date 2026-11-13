// @env browser

import { createGlobalState, StorageSerializers, useSessionStorage } from '@vueuse/core'
import { i18n } from '~/i18n'
import { CREDENTIAL_SESSION_KEY } from './constants'
import type { CredentialSession } from './types'

/** Explicit sign-in stays selected across reloads in this tab. */
export const useCredentialSession = createGlobalState(() => {
  const session = useSessionStorage<CredentialSession | null>(CREDENTIAL_SESSION_KEY, null, {
    shallow: true,
    deep: false,
    serializer: StorageSerializers.object,
  })

  function selectSession(login: CredentialSession): void {
    if (!login.token.trim()) throw new Error(i18n.global.t('auth.invalidSession'))
    session.value = {
      token: login.token,
      userId: login.userId,
      account: login.account,
      source: login.source,
    }
  }

  return { session, selectSession }
})
