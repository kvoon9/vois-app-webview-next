import type { BridgeFn, WebviewBridge } from '@vois/webview-bridge'
import type { LocationQuery } from 'vue-router'

/** Give up on an unanswered bridge request after this long. */
export const PAGE_PARAMS_TIMEOUT_MS = 3000

/** Any JSON value. Native owns the field layout until the backend contract lands. */
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject

/** Open page-param object; concrete fields get added once the backend settles them. */
export interface JsonObject {
  [key: string]: JsonValue
}

/** Request payload: which page the params are for. */
export interface PageParamsRequest {
  page: string
}

/** Response envelope, following the built-in prepay protocols. */
export interface PageParamsResponse {
  errcode: number
  errmsg: string
  /** Absent when native answers with a non-zero `errcode`. */
  data?: JsonObject
}

declare module '@vois/webview-bridge' {
  interface BridgeProtocolMap {
    'get-page-params': BridgeFn<PageParamsRequest, PageParamsResponse>
  }
}

/** Where the page gets its bridge from. */
export interface PageParamsBridgeSource {
  /** Whether this environment ever gets a native bridge; desktop never does. */
  supported: boolean
  /** Resolves with the ready bridge; never settles where `supported` is false. */
  whenReady: () => Promise<WebviewBridge | undefined>
}

/** What the page can show after asking native for its params. */
export type PageParamsOutcome =
  | { status: 'ok'; response: PageParamsResponse }
  | { status: 'unsupported' }
  // `detail` carries native's own message when it answered with a non-zero errcode
  | { status: 'failed'; detail?: string }

/** Key/value row shared by the URL query and page-param sections. */
export interface DisplayRow {
  key: string
  value: string
}

/** URL query as display rows; a repeated key keeps every value in order. */
export function queryRows(query: LocationQuery): DisplayRow[] {
  return Object.entries(query).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? value.map((item) => item ?? '').join(', ') : (value ?? ''),
  }))
}

/** Open page-param fields as rows, each value rendered as JSON text. */
export function objectRows(value?: JsonObject): DisplayRow[] {
  return Object.entries(value ?? {}).map(([key, item]) => ({ key, value: JSON.stringify(item) }))
}

/**
 * Ask native for the page params. Reports `unsupported` where no native bridge
 * exists, and `failed` when the bridge or its answer never arrives, so the page
 * never waits on a promise that cannot settle. `timeoutMs` bounds both waits.
 */
export async function fetchPageParams(
  source: PageParamsBridgeSource,
  page: string,
  timeoutMs: number = PAGE_PARAMS_TIMEOUT_MS,
): Promise<PageParamsOutcome> {
  if (!source.supported) return { status: 'unsupported' }

  try {
    const outcome = await withTimeout(askNative(source, page), timeoutMs)
    return outcome ?? { status: 'failed' }
  } catch {
    return { status: 'failed' }
  }
}

async function askNative(source: PageParamsBridgeSource, page: string): Promise<PageParamsOutcome> {
  const bridge = await source.whenReady()
  // Widening to `unknown` (unregistered protocol) would break this annotation,
  // so the module augmentation above has to stay in the type graph.
  const response: PageParamsResponse | undefined = await bridge?.request('get-page-params', {
    page,
  })
  if (!response) return { status: 'failed' }
  if (response.errcode !== 0) {
    return { status: 'failed', detail: `${response.errcode}: ${response.errmsg}` }
  }
  return { status: 'ok', response }
}

/** The promise's value, or `undefined` once it outlasts `ms`. */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
