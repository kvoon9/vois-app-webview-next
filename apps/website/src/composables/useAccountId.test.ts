import { describe, expect, it } from 'vite-plus/test'
import { computed, shallowRef } from 'vue'
import { createAccountIdState, parseAccountId } from './useAccountId'
import { PageParamsError, type PageParams, type PageParamsStatus } from './usePageParams'
import type { H5NavigationContext } from './useNavigationContext'
import type { CredentialSession } from '~/utils/auth/types'

describe('parseAccountId', () => {
  it('reads a positive safe integer', () => {
    expect(parseAccountId('441')).toBe(441)
  })

  it.each(['', null, undefined, '0', '-1', '1.5', 'abc', '9007199254740992'])(
    'rejects invalid input: %s',
    (value) => {
      expect(parseAccountId(value)).toBeNull()
    },
  )
})

describe('account readiness', () => {
  function accountState() {
    const params = shallowRef<PageParams>({ 'login-id': '441' })
    const status = shallowRef<PageParamsStatus>('pending')
    const error = shallowRef<PageParamsError | null>(null)
    const context = shallowRef<H5NavigationContext>({})
    const session = shallowRef<CredentialSession | null>(null)
    const state = createAccountIdState(
      { params: computed(() => params.value), status, error, reload: async () => {} },
      context,
      session,
    )
    return { state, status, error, context, session }
  }

  it('loads a selected account without waiting for native page params', () => {
    const { state, session, error } = accountState()
    session.value = { token: 'synthetic', userId: 123 }
    expect(state.accountId.value).toBe(123)
    expect(state.status.value).toBe('ready')
    error.value = new PageParamsError('timeout', 'timeout')
    expect(state.error.value).toBeNull()
  })

  it('keeps the device account ready after a native timeout', () => {
    const { state, context, session, status, error } = accountState()
    context.value = { accountId: 456 }
    session.value = { token: 'synthetic', userId: 123 }
    status.value = 'error'
    error.value = new PageParamsError('timeout', 'timeout')
    expect(state.accountId.value).toBe(456)
    expect(state.status.value).toBe('ready')
    expect(state.error.value).toBeNull()
  })

  it('requires the native read again when an explicit selection is cleared', () => {
    const { state, session, status, error } = accountState()
    session.value = { token: 'synthetic', userId: 123 }
    session.value = null
    expect(state.status.value).toBe('pending')
    status.value = 'error'
    error.value = new PageParamsError('timeout', 'timeout')
    expect(state.status.value).toBe('error')
    expect(state.error.value?.reason).toBe('timeout')
    status.value = 'ready'
    error.value = null
    expect(state.accountId.value).toBe(441)
    expect(state.status.value).toBe('ready')
  })
})
