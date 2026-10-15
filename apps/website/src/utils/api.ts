// @env browser

import md5 from 'md5'
import { i18n } from '~/i18n'
import { useCredentialSession } from '~/utils/auth'
import { bridge } from '~/utils/bridge'

interface WeilaResponse<T> {
  errcode: number
  errmsg: string
  data: T
}

/** Per-call deadline shared by `weilaFetch` and `weilaUpload`. */
export interface TimeoutOptions {
  /** Milliseconds before the HTTP call is aborted; falls back to the call's own default. */
  timeoutMs?: number
}

/** Request shape for `weilaFetch`. */
export interface RequestOptions extends TimeoutOptions {
  method?: 'GET' | 'POST'
  body?: Record<string, string | number | boolean | readonly (string | number)[] | undefined>
}

const APP_ID = import.meta.env.VITE_APP_ID
const APP_KEY = import.meta.env.VITE_APP_KEY

/** Small JSON bodies get a shorter deadline than uploads. */
const FETCH_TIMEOUT_MS = 15_000
/** Uploads run on slow device networks, so they get a longer deadline. */
const UPLOAD_TIMEOUT_MS = 30_000

/** Server code that means the request's session token is no longer accepted. */
export const AUTH_EXPIRED_ERRCODE = 31

/** Local code for a call that passed its deadline; the server never sends it. */
const TIMEOUT_ERRCODE = -1

/** A failed `/v2` call, carrying the code the caller can branch on. */
export class WeilaApiError extends Error {
  /** Server `errcode`, the HTTP status, or `TIMEOUT_ERRCODE` for a local deadline. */
  readonly errcode: number
  /** Raw server `errmsg` when the server answered, otherwise an empty string. */
  readonly errmsg: string

  constructor(errcode: number, errmsg: string, message: string) {
    super(message)
    this.name = 'WeilaApiError'
    this.errcode = errcode
    this.errmsg = errmsg
  }
}

/** Picks the message a page can show for a failed call. */
function errorMessage(errcode: number, errmsg: string): string {
  if (errcode === AUTH_EXPIRED_ERRCODE) return i18n.global.t('error.authExpired')
  return errmsg || i18n.global.t('error.description')
}

/**
 * Drops the explicitly selected H5 session when the server rejects its token, so the
 * next `bridge.getAccessToken()` asks native again instead of reusing a dead token.
 * A native-only session has no H5 selection, so it is left untouched.
 */
function invalidateRejectedSession(errcode: number): void {
  if (errcode !== AUTH_EXPIRED_ERRCODE) return
  const { session } = useCredentialSession()
  if (session.value) session.value = null
}

/** Builds the error for a business `errcode` and invalidates a rejected H5 session first. */
function serverFailure(errcode: number, errmsg: string): WeilaApiError {
  invalidateRejectedSession(errcode)
  return new WeilaApiError(errcode, errmsg, errorMessage(errcode, errmsg))
}

/** Builds the error for a non-2xx HTTP status. */
function httpFailure(response: Response): WeilaApiError {
  return new WeilaApiError(
    response.status,
    response.statusText,
    i18n.global.t('error.networkError'),
  )
}

/**
 * Runs the HTTP call with a deadline. When the timer fires, `fetch` rejects with an
 * abort DOMException; that is replaced with a typed timeout so callers show a friendly
 * message. Non-timeout failures pass through unchanged.
 */
async function fetchWithTimeout(
  timeoutMs: number,
  request: (signal: AbortSignal) => Promise<Response>,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await request(controller.signal)
  } catch (error) {
    if (controller.signal.aborted) {
      throw new WeilaApiError(TIMEOUT_ERRCODE, '', i18n.global.t('error.networkTimeout'))
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** Calls a `/v2` endpoint with auth query params and returns the parsed envelope. */
export async function weilaFetch<T>(
  url: string,
  options: RequestOptions = {},
): Promise<WeilaResponse<T>> {
  const urlWithAuth = await buildAuthUrl(url)

  const response = await fetchWithTimeout(options.timeoutMs ?? FETCH_TIMEOUT_MS, (signal) =>
    fetch(urlWithAuth, {
      method: options.method ?? 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal,
    }),
  )

  if (!response.ok) throw httpFailure(response)

  // SAFETY: the server contract guarantees the { errcode, errmsg, data } envelope; data shape is the per-endpoint T
  const data = (await response.json()) as WeilaResponse<T>
  if (data.errcode !== 0) throw serverFailure(data.errcode, data.errmsg)

  return data
}

/** Uploads a file via `/v2/common/upload-file`; resolves to the hosted URL. */
export async function weilaUpload(
  file: Blob,
  fileName: string,
  options: TimeoutOptions = {},
): Promise<string> {
  const formData = new FormData()
  formData.append('file', file, fileName)
  const url = await buildAuthUrl('/v2/common/upload-file')

  // Content-Type must stay unset so the browser emits the multipart boundary
  const response = await fetchWithTimeout(options.timeoutMs ?? UPLOAD_TIMEOUT_MS, (signal) =>
    fetch(url, { method: 'POST', body: formData, signal }),
  )
  if (!response.ok) throw httpFailure(response)

  // SAFETY: same envelope contract as weilaFetch
  const data = (await response.json()) as WeilaResponse<{ url: string }>
  if (data.errcode !== 0) throw serverFailure(data.errcode, data.errmsg)
  return data.data.url
}

async function buildAuthUrl(url: string): Promise<URL> {
  const token = await bridge.getAccessToken()
  const query = generateV2Query(APP_ID, APP_KEY)
  const urlWithAuth = new URL(url, window.location.origin)
  urlWithAuth.searchParams.set('appid', query.appid)
  urlWithAuth.searchParams.set('et', query.et)
  urlWithAuth.searchParams.set('sign', query.sign)
  urlWithAuth.searchParams.set('token', token)
  return urlWithAuth
}

/** Builds the signed `appid` / `et` / `sign` query the `/v2` endpoints expect. */
export function generateV2Query(appid: string, appkey: string) {
  const et = Math.floor(Date.now() / 1000)
  const appSign = md5(`${et}${appkey}`)

  return {
    appid,
    et: String(et),
    sign: appSign.slice(12, 20),
  }
}
