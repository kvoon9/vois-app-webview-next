import { useRouteQuery } from '@vueuse/router'
import { computed } from 'vue'

export function parseAccountId(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

/**
 * Current translation account: the device `user-id` when inside the device flow,
 * otherwise the owner's `login-id`.
 */
export function useAccountId() {
  const loginIdQuery = useRouteQuery<string | null>('login-id')
  const userIdQuery = useRouteQuery<string | null>('user-id')

  // Hash routing never touches the outer ?search, so launch-time login-id stays readable there
  const launchLoginId = parseAccountId(new URLSearchParams(window.location.search).get('login-id'))

  const loginId = computed(() => parseAccountId(loginIdQuery.value) ?? launchLoginId)
  const userId = computed(() => parseAccountId(userIdQuery.value))
  const accountId = computed(() => userId.value ?? loginId.value)

  // Spread into router.push/RouterLink query to keep the account context across navigation
  const accountQuery = computed(() => {
    const query: Record<string, string> = {}
    if (loginId.value != null) query['login-id'] = String(loginId.value)
    if (userId.value != null) query['user-id'] = String(userId.value)
    return query
  })

  return { accountId, userId, accountQuery }
}
