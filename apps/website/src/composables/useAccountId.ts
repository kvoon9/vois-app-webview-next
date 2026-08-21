import { useRouteQuery } from '@vueuse/router'
import { computed } from 'vue'

export function parseAccountId(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

/**
 * Current translation account: the owner's `login-id`, or the device's id
 * passed as `login-id` when inside the device flow.
 */
export function useAccountId() {
  const loginIdQuery = useRouteQuery<string | null>('login-id')

  // Hash routing never touches the outer ?search, so launch-time login-id stays readable there
  const launchLoginId = parseAccountId(new URLSearchParams(window.location.search).get('login-id'))

  const accountId = computed(() => parseAccountId(loginIdQuery.value) ?? launchLoginId)

  // Spread into router.push/RouterLink query to keep the account context across navigation
  const accountQuery = computed(() =>
    accountId.value == null ? {} : { 'login-id': String(accountId.value) },
  )

  return { accountId, accountQuery }
}
