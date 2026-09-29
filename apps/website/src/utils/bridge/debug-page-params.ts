import { array, looseObject, object, optional, record, safeParse, string, unknown } from 'valibot'

/**
 * The only fields native's `get-page-params` can answer (its web default set),
 * minus the token: a debug URL may stand in for native for these, never for an
 * auth field or a page-owned id (`uuid`, `hardware-id`, ...) native cannot read.
 */
export const DEBUG_PAGE_PARAM_KEYS: ReadonlySet<string> = new Set([
  'login-id',
  'theme',
  'lang',
  'device-type',
  'pkg-name',
  'wxpay-appid',
  'pay-method',
])

/**
 * URL params a debug session injects: the outer search first, the hash query
 * over it, keeping only the fields native itself could answer. Repeated keys
 * keep the last value.
 */
export function debugUrlPageParams(search: string, hash: string): Record<string, string> {
  const layers = [new URLSearchParams(search)]
  const separator = hash.indexOf('?')
  if (separator >= 0) layers.push(new URLSearchParams(hash.slice(separator + 1)))

  return Object.fromEntries(
    layers.flatMap((query) => [...query]).filter(([key]) => DEBUG_PAGE_PARAM_KEYS.has(key)),
  )
}

/** An answer body is a plain object by contract; unknown keys stay so nothing is dropped. */
const answerSchema = looseObject({})

/** Only `params` matters to the filter; anything else means "inject everything". */
const requestSchema = object({
  params: optional(array(string())),
})

/**
 * Merge a debug session's URL params into native's answer, keeping native's
 * requested-name filter: when the request named params, only those names are
 * injected, otherwise every injected name lands. `errcode` is never touched,
 * and a non-object answer comes back untouched.
 */
export function mergeDebugPageParams<Answer, Request>(
  response: Answer,
  request: Request,
  injected: Record<string, string>,
): Answer {
  if (Array.isArray(response)) return response
  const decoded = safeParse(answerSchema, response)
  if (!decoded.success) return response

  const asked = safeParse(requestSchema, request)
  const names = asked.success ? asked.output.params : undefined

  const picked: Record<string, string> = {}
  for (const [key, value] of Object.entries(injected)) {
    if (names !== undefined && names.length > 0 && !names.includes(key)) continue
    picked[key] = value
  }

  const source = decoded.output
  const nested = Array.isArray(source.data)
    ? undefined
    : safeParse(record(string(), unknown()), source.data)
  const existing = nested?.success ? nested.output : {}
  const data = { ...existing, ...picked }

  // SAFETY: native's own answer object with `data` re-merged; the generic keeps
  // the caller's protocol type, and only `data` was rebuilt.
  return { ...source, data } as Answer
}
