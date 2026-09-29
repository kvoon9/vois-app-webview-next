import { computed } from 'vue'
import { useNavigationContext } from '~/composables/useNavigationContext'
import { usePageParams } from '~/composables/usePageParams'

export function parseAccountId(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

/**
 * Current translation account: the device flow's pushed override, else native's launch
 * `login-id`. The status/error/reload triple describes the native read, so callers gate
 * their own queries until the account is settled.
 */
export function useAccountId() {
  const { context } = useNavigationContext()
  const { params, status, error, reload } = usePageParams(['login-id'])

  return {
    accountId: computed(() => context.value.accountId ?? parseAccountId(params.value['login-id'])),
    status,
    error,
    reload,
  }
}
