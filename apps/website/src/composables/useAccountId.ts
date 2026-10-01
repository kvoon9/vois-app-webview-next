import { computed, type ShallowRef } from 'vue'
import { useNavigationContext, type H5NavigationContext } from '~/composables/useNavigationContext'
import { usePageParams, type PageParamsHandle } from '~/composables/usePageParams'
import { useCredentialSession } from '~/utils/auth'
import type { CredentialSession } from '~/utils/auth/types'

export function parseAccountId(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

/** An explicit account is ready even while unrelated native page params are pending or failed. */
export function createAccountIdState(
  pageParams: PageParamsHandle,
  context: ShallowRef<H5NavigationContext>,
  session: ShallowRef<CredentialSession | null>,
) {
  const explicitAccountId = computed(() =>
    parseAccountId(String(context.value.accountId ?? session.value?.userId ?? '')),
  )
  return {
    accountId: computed(
      () => explicitAccountId.value ?? parseAccountId(pageParams.params.value['login-id']),
    ),
    status: computed(() => (explicitAccountId.value !== null ? 'ready' : pageParams.status.value)),
    error: computed(() => (explicitAccountId.value !== null ? null : pageParams.error.value)),
    reload: pageParams.reload,
  }
}

export function useAccountId() {
  const { context } = useNavigationContext()
  const { session } = useCredentialSession()
  return createAccountIdState(usePageParams(['login-id']), context, session)
}
