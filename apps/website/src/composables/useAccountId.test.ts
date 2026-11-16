import { Bridge } from '@vois/webview-bridge'
import { describe, expect, it } from 'vite-plus/test'
import { computed, shallowRef } from 'vue'
import { createAccountIdState, parseAccountId } from './useAccountId'
import {
  createPageParamsStore,
  PageParamsError,
  type PageParams,
  type PageParamsStatus,
} from './usePageParams'
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

/** A real bridge whose native replies the test releases by request index. */
function deferredBridge() {
  const answers: Array<(raw: string) => void> = []
  const bridge = Bridge.create((_type, _data, onResponse) => {
    if (onResponse) answers.push(onResponse)
  })
  return { bridge, answers }
}

function okAnswer(data: PageParams): string {
  return JSON.stringify({ errcode: 0, errmsg: 'ok', data })
}

/** Lets queued microtasks and the bridge's own promises settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/** The real page-params store, answered by hand through `answers`. */
function storeAccountState() {
  const { bridge, answers } = deferredBridge()
  const store = createPageParamsStore({ supported: () => true, whenReady: async () => bridge })
  const context = shallowRef<H5NavigationContext>({})
  const session = shallowRef<CredentialSession | null>(null)
  const state = createAccountIdState(
    {
      params: computed(() => store.params.value),
      status: store.status,
      error: store.error,
      reload: () => store.reload(),
    },
    context,
    session,
  )
  return { state, store, answers, context, session }
}

describe('account readiness against the page-params store', () => {
  it('keeps the native answer through account selection changes', async () => {
    const { state, store, answers, session } = storeAccountState()

    store.observe('/a', ['login-id'])
    await flush()
    expect(state.status.value).toBe('pending')
    expect(state.accountId.value).toBeNull()

    answers[0]?.(okAnswer({ 'login-id': '441' }))
    await flush()
    expect(state.status.value).toBe('ready')
    expect(state.accountId.value).toBe(441)

    session.value = { token: 'synthetic', userId: 123 }
    expect(state.status.value).toBe('ready')
    expect(state.accountId.value).toBe(123)

    session.value = null
    expect(state.status.value).toBe('ready')
    expect(state.accountId.value).toBe(441)

    store.observe('/b', ['login-id'])
    await flush()
    expect(state.status.value).toBe('pending')
    expect(state.accountId.value).toBeNull()

    answers[1]?.(okAnswer({ 'login-id': '456' }))
    await flush()
    expect(state.status.value).toBe('ready')
    expect(state.accountId.value).toBe(456)
  })

  it('drops a late answer from the previous page', async () => {
    const { state, store, answers } = storeAccountState()

    store.observe('/a', ['login-id'])
    await flush()
    store.observe('/b', ['login-id'])
    await flush()
    expect(state.status.value).toBe('pending')
    expect(state.accountId.value).toBeNull()

    answers[0]?.(okAnswer({ 'login-id': '441' }))
    await flush()
    expect(state.status.value).toBe('pending')
    expect(state.accountId.value).toBeNull()

    answers[1]?.(okAnswer({ 'login-id': '789' }))
    await flush()
    expect(state.status.value).toBe('ready')
    expect(state.accountId.value).toBe(789)
  })

  it('reports a native error until a device account makes the page ready', async () => {
    const { state, store, answers, context } = storeAccountState()

    store.observe('/c', ['login-id'])
    await flush()
    answers[0]?.(JSON.stringify({ errcode: 31, errmsg: 'auth expired' }))
    await flush()
    expect(state.status.value).toBe('error')
    expect(state.error.value?.nativeCode).toBe(31)
    expect(state.accountId.value).toBeNull()

    context.value = { accountId: 999 }
    expect(state.status.value).toBe('ready')
    expect(state.accountId.value).toBe(999)
    expect(state.error.value).toBeNull()
  })
})
