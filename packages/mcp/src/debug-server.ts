import * as v from 'valibot'
import type { DebugCredentials } from './config.ts'
import { decodeField, parseJson } from './json.ts'

/** What `/__debug/status` answers for a live debug server. */
export interface DebugServerStatus {
  port: number
  count: number
  sizeBytes: number
  sessionStartedAt: number
  now: number
}

/** A signed-in debug session; `token` never leaves the server process. */
export interface DebugSession {
  token: string
  userId?: number
}

/** Injectable fetch, so tests drive every server exchange with fakes. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

const StatusSchema = v.object({
  count: v.number(),
  sizeBytes: v.number(),
  sessionStartedAt: v.number(),
  now: v.number(),
})

const SessionSchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
  userId: v.optional(v.number()),
})

const ErrorSchema = v.object({ error: v.string() })

/** How long a status probe may take before the port counts as dead. */
const PROBE_TIMEOUT_MS = 2000

/** Login and token reads include a cold gateway mint, which may take seconds. */
const SESSION_TIMEOUT_MS = 20_000

/** Base URL of the debug endpoints a vite debug server mounts. */
function serverUrl(port: number, path: string): string {
  return `http://127.0.0.1:${port}${path}`
}

/**
 * Extracts the server's error line from a failed response body, falling back
 * to the HTTP status when the body is not the expected `{ error }` shape.
 */
function serverError(status: number, body: string): string {
  const decoded = decodeField(ErrorSchema, parseJson(body))
  const message = decoded?.error
  return message !== undefined && message !== '' ? message : `HTTP ${status}`
}

/**
 * Asks one port whether a debug server lives there. Returns `null` for
 * connection failures, timeouts, and answers that are not a status payload.
 */
export async function probeDebugServer(
  port: number,
  fetchImpl: FetchLike = fetch,
): Promise<DebugServerStatus | null> {
  try {
    const response = await fetchImpl(serverUrl(port, '/__debug/status'), {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (!response.ok) return null
    const status = decodeField(StatusSchema, parseJson(await response.text()))
    return status === undefined ? null : { port, ...status }
  } catch {
    return null
  }
}

/** Reads the access-token session the server currently mints for pages. */
export async function readDebugSession(
  port: number,
  fetchImpl: FetchLike = fetch,
): Promise<DebugSession> {
  const response = await fetchImpl(serverUrl(port, '/__vois-bridge/access-token'), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(serverError(response.status, body))
  const session = decodeField(SessionSchema, parseJson(body))
  if (session === undefined) throw new Error(`token endpoint answer is malformed`)
  return session
}

/**
 * Signs in with `credentials` through the debug server, replacing the account
 * every later page reads. The server's message (for example 账号或密码错误)
 * is surfaced verbatim so the model can tell the user what went wrong.
 */
export async function loginDebugAccount(
  port: number,
  credentials: DebugCredentials,
  fetchImpl: FetchLike = fetch,
): Promise<DebugSession> {
  const response = await fetchImpl(serverUrl(port, '/__vois-bridge/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
    signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(serverError(response.status, body))
  const session = decodeField(SessionSchema, parseJson(body))
  if (session === undefined) throw new Error(`login answer is malformed`)
  return session
}
