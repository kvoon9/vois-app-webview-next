// @env browser

import { createGlobalState, StorageSerializers, useSessionStorage } from '@vueuse/core'
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
    if (!login.token.trim()) throw new Error('登录信息不可用，请重试。')
    session.value = { token: login.token, userId: login.userId }
  }

  return { session, selectSession }
})
