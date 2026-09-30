import { createHash } from 'node:crypto'
import type { JsonObject, JsonValue } from './json.ts'
import { parseJson } from './json.ts'
import type { FetchLike } from './debug-server.ts'

/** Query parameters every `/v2` request carries, as the website signs them. */
export interface V2Query {
  appid: string
  et: string
  sign: string
}

/** Outcome of one API call; failures keep their status and body for display. */
export interface VoisApiResult {
  httpStatus: number
  body: JsonValue
  isJson: boolean
}

/** Named inputs for one signed API call. */
export interface VoisApiOptions {
  apiBase: string
  path: string
  method: 'GET' | 'POST'
  body?: JsonObject
  query?: Record<string, string | number>
  appId: string
  appKey: string
  token: string
  fetchImpl?: FetchLike
}

/** How long an API call may run before it is abandoned. */
const API_TIMEOUT_MS = 30_000

/**
 * Query names the signed auth owns. A caller query with these names is
 * dropped instead of applied, so `query: { token: ... }` can never replace
 * the session token or break the signature.
 */
const RESERVED_QUERY_KEYS = new Set(['appid', 'et', 'sign', 'token'])

/**
 * Builds the `appid` / `et` / `sign` triple. Same recipe as the website's
 * `generateV2Query`: `sign` is characters 12 to 20 of `md5(et + appKey)`.
 */
export function generateV2Query(
  appId: string,
  appKey: string,
  nowMs: number = Date.now(),
): V2Query {
  const et = Math.floor(nowMs / 1000)
  const sign = createHash('md5').update(`${et}${appKey}`).digest('hex').slice(12, 20)
  return { appid: appId, et: String(et), sign }
}

/** Joins the API origin and a `/v2/...` path into one absolute URL. */
export function apiBaseUrl(apiBase: string, path: string): URL {
  return new URL(
    path.startsWith('/') ? path : `/${path}`,
    apiBase.endsWith('/') ? apiBase : `${apiBase}/`,
  )
}

/**
 * Builds the full signed URL: API path first, then the auth triple and the
 * session token, matching `weilaFetch`'s `buildAuthUrl` field for field.
 */
export function buildSignedUrl(options: {
  apiBase: string
  path: string
  appId: string
  appKey: string
  token: string
  nowMs?: number
}): URL {
  const url = apiBaseUrl(options.apiBase, options.path)
  const query = generateV2Query(options.appId, options.appKey, options.nowMs)
  url.searchParams.set('appid', query.appid)
  url.searchParams.set('et', query.et)
  url.searchParams.set('sign', query.sign)
  url.searchParams.set('token', options.token)
  return url
}

/**
 * Performs one signed API call. A non-zero `errcode` or an HTTP failure is a
 * normal outcome here, not a throw: debugging wants the envelope verbatim.
 */
export async function callVoisApi(options: VoisApiOptions): Promise<VoisApiResult> {
  const url = buildSignedUrl(options)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (RESERVED_QUERY_KEYS.has(key.toLowerCase())) continue
    url.searchParams.set(key, String(value))
  }
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(url.toString(), {
    method: options.method,
    headers: options.method === 'POST' ? { 'content-type': 'application/json' } : undefined,
    body:
      options.method === 'POST' && options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
  const text = await response.text()
  const decoded = parseJson(text)
  if (decoded !== undefined) return { httpStatus: response.status, body: decoded, isJson: true }
  return { httpStatus: response.status, body: text.slice(0, 2000), isJson: false }
}
