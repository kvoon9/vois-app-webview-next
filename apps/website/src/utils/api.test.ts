import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { i18n } from '~/i18n'
import { useCredentialSession } from '~/utils/auth'
import {
  AUTH_EXPIRED_ERRCODE,
  WeilaApiError,
  generateV2Query,
  weilaFetch,
  weilaUpload,
} from './api'

const TOKEN = 'selected-token'

/** Selects an H5 session so `bridge.getAccessToken()` never reaches native. */
function selectSession(token = TOKEN): void {
  useCredentialSession().selectSession({ token, userId: 1 })
}

/** A fetch double that answers each call with the given JSON body. */
function jsonFetch(json: string, status = 200): ReturnType<typeof vi.fn> {
  return vi.fn(async () => new Response(json, { status }))
}

/** A fetch double that only settles when the request's signal aborts. */
function hangingFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      }),
  )
}

describe('generateV2Query', () => {
  it('builds the appid, a seconds timestamp, and an eight character sign', () => {
    const query = generateV2Query('app-id', 'app-key')

    expect(query.appid).toBe('app-id')
    expect(query.et).toMatch(/^\d+$/)
    expect(query.sign).toHaveLength(8)
  })
})

describe('weilaFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost' } })
    // The in-memory session ref has no storage backend in this environment.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useCredentialSession().session.value = null
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns the parsed envelope of a successful call', async () => {
    vi.stubGlobal('fetch', jsonFetch(JSON.stringify({ errcode: 0, errmsg: '', data: { id: 7 } })))
    selectSession()

    await expect(weilaFetch<{ id: number }>('/v2/example')).resolves.toEqual({
      errcode: 0,
      errmsg: '',
      data: { id: 7 },
    })
  })

  it('maps errcode 31 to the auth-expired message and drops the selected H5 session', async () => {
    vi.stubGlobal(
      'fetch',
      jsonFetch(JSON.stringify({ errcode: AUTH_EXPIRED_ERRCODE, errmsg: 'auth expired' })),
    )
    selectSession()

    const promise = weilaFetch('/v2/example')
    await expect(promise).rejects.toBeInstanceOf(WeilaApiError)
    await expect(promise).rejects.toMatchObject({
      errcode: AUTH_EXPIRED_ERRCODE,
      errmsg: 'auth expired',
    })
    await expect(promise).rejects.toThrow(i18n.global.t('error.authExpired'))
    expect(useCredentialSession().session.value).toBeNull()
  })

  it('keeps the selected session for a server error other than 31', async () => {
    vi.stubGlobal('fetch', jsonFetch(JSON.stringify({ errcode: 5, errmsg: 'boom' })))
    selectSession()

    await expect(weilaFetch('/v2/example')).rejects.toThrow('boom')
    expect(useCredentialSession().session.value?.token).toBe(TOKEN)
  })

  it('maps a non-2xx status to the network error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    )
    selectSession()

    const promise = weilaFetch('/v2/example')
    await expect(promise).rejects.toThrow(i18n.global.t('error.networkError'))
    await expect(promise).rejects.toMatchObject({ errcode: 500 })
  })

  it('aborts a hanging fetch at the per-call timeout with a friendly message', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hangingFetch())
    selectSession()

    let caught: WeilaApiError | undefined
    const promise = weilaFetch('/v2/example', { timeoutMs: 1000 }).catch((error: WeilaApiError) => {
      caught = error
    })
    await vi.advanceTimersByTimeAsync(1000)
    await promise

    expect(caught).toBeInstanceOf(WeilaApiError)
    expect(caught?.message).toBe(i18n.global.t('error.networkTimeout'))
    expect(caught?.errcode).toBeLessThan(0)
  })

  it('uses the fifteen second default when no timeout is given', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hangingFetch())
    selectSession()

    let settled = false
    const promise = weilaFetch('/v2/example').catch(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(14_999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await promise
    expect(settled).toBe(true)
  })
})

describe('weilaUpload', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    useCredentialSession().session.value = null
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('posts a multipart body and resolves to the hosted URL', async () => {
    const requests: RequestInit[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init) requests.push(init)
        return new Response(
          JSON.stringify({ errcode: 0, errmsg: '', data: { url: 'https://cdn/x' } }),
        )
      }),
    )
    selectSession()

    await expect(weilaUpload(new Blob(['body']), 'file.txt')).resolves.toBe('https://cdn/x')
    expect(requests[0]?.body).toBeInstanceOf(FormData)
  })

  it('uses the thirty second upload default when no timeout is given', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hangingFetch())
    selectSession()

    let settled = false
    const promise = weilaUpload(new Blob(['body']), 'file.txt').catch(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(29_999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await promise
    expect(settled).toBe(true)
  })
})
