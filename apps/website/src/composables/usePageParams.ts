import { isSupportBridge, type BridgeFn, type WebviewBridge } from '@vois/webview-bridge'
import {
  boolean,
  number,
  object,
  optional,
  record,
  safeParse,
  string,
  union,
  unknown,
  type InferOutput,
} from 'valibot'
import { computed, onMounted, shallowRef, type ComputedRef, type ShallowRef } from 'vue'
import { useRoute, type LocationQuery } from 'vue-router'
import { whenWebviewBridge } from '~/composables/useWebviewBridge'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import { accessToken, nativeLang, nativeTheme } from '~/constants'
import { SAVE_ACCESS_TOKEN_PATH } from '~/utils/auth-token-path'

/** Give up on an unanswered bridge request after this long; native's own budget. */
export const PAGE_PARAMS_TIMEOUT_MS = 3000

/** Page params are flat string key/values by contract; nesting is out of scope. */
export interface PageParams {
  [key: string]: string
}

/**
 * Native's answer, decoded at the bridge boundary. `errcode` and `errmsg` are
 * the contract, `data` is an open bag whose values are read one by one.
 */
const pageParamsSchema = object({
  errcode: number(),
  errmsg: string(),
  data: optional(record(string(), unknown())),
})

/**
 * A value this page can render. The protocol forbids nesting, so a nested value
 * is a native bug and gets dropped rather than reaching the page.
 */
const scalarSchema = union([string(), number(), boolean()])

type PageParamsResponse = InferOutput<typeof pageParamsSchema>

/**
 * Request payload: which page is asking, and which names it reads. An empty
 * `params` means "everything native injects by default", which is how a page
 * gets `access-token` without naming it.
 */
export interface PageParamsRequest {
  page: string
  params: readonly string[]
}

declare module '@vois/webview-bridge' {
  interface BridgeProtocolMap {
    'get-page-params': BridgeFn<PageParamsRequest, PageParamsResponse>
  }
}

/** Where the params come from; injectable so the fetch is testable without a WebView. */
export interface PageParamsBridgeSource {
  /** Whether this environment ever gets a native bridge; desktop never does. */
  supported: boolean
  /** Resolves with the ready bridge; never settles where `supported` is false. */
  whenReady: () => Promise<WebviewBridge | undefined>
}

/** What `usePageParams` hands the page. */
export interface PageParamsHandle {
  /** Native's values with the route query laid over them. */
  params: ComputedRef<PageParams>
  /** Whether the bridge attempt finished, so a caller can end its own wait. */
  settled: ShallowRef<boolean>
  /** Ask native again; the page's retry button calls this. */
  reload: () => Promise<void>
}

/**
 * Ask native for its default params. Returns an empty object whenever the
 * answer is unusable: no bridge, a timeout, an unparseable body, or a non-zero
 * `errcode`. Callers read values, not failure reasons, so a missing field and a
 * missing answer are the same thing to them.
 */
export async function fetchPageParams(
  source: PageParamsBridgeSource,
  page: string,
  params: readonly string[] = [],
  timeoutMs: number = PAGE_PARAMS_TIMEOUT_MS,
): Promise<PageParams> {
  if (!source.supported) return {}

  const answer = await withTimeout(
    askNative(source, page, params).catch(() => undefined),
    timeoutMs,
  )
  const decoded = safeParse(pageParamsSchema, answer)
  if (!answer || !decoded.success || decoded.output.errcode !== 0) return {}

  const values: PageParams = {}
  for (const [key, value] of Object.entries(decoded.output.data ?? {})) {
    // A value native could not read, or one the protocol forbids, has no
    // string form; leaving the key out is how the page sees "not provided".
    const scalar = safeParse(scalarSchema, value)
    if (scalar.success) values[key] = String(scalar.output)
  }
  return values
}

async function askNative(
  source: PageParamsBridgeSource,
  page: string,
  params: readonly string[],
): Promise<PageParamsResponse> {
  const bridge = await source.whenReady()
  if (!bridge) throw new Error('no bridge')
  const response = await bridge.request('get-page-params', { page, params: [...params] })
  return response
}

/** The promise's value, or `undefined` once it outlasts `ms`. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
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

/** Route query as flat strings; the protocol carries one value per key. */
function queryParams(query: LocationQuery): PageParams {
  const values: PageParams = {}
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first != null) values[key] = first
  }
  return values
}

/**
 * What native sent, with the route query laid over it. The query describes this
 * navigation, so a key present there outranks native's default; native is the
 * fallback, not the override.
 */
export function mergePageParams(bridgeParams: PageParams, query: LocationQuery): PageParams {
  const values: PageParams = { ...bridgeParams }
  for (const [key, value] of Object.entries(queryParams(query))) values[key] = value
  return values
}

/**
 * Hand a token that arrived over the bridge to the dev server, which writes it
 * to the shared env file.
 *
 * The debug plugin only persists tokens it finds in a page URL, and a bridge
 * token never appears in one. Without this, a bridge-authenticated session
 * leaves the env file holding whatever token an earlier launch captured, so the
 * next desktop run authenticates as the wrong account. Production has no such
 * endpoint.
 */
function persistTokenForDebug(token: string): void {
  if (!isWebviewDebug()) return
  void fetch(SAVE_ACCESS_TOKEN_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }).catch(() => {
    /* dev servers only; a failed write costs nothing at runtime */
  })
}

/**
 * Page params for the current route.
 *
 * A non-empty `access-token` from either source is written to the shared token
 * the request layer reads. A missing one never clears a working token, so a
 * desktop launch or a silent bridge keeps whatever the app already resolved.
 */
export function usePageParams(params: readonly string[] = []): PageParamsHandle {
  const route = useRoute()
  const bridgeParams = shallowRef<PageParams>({})
  const settled = shallowRef(false)

  const values = computed(() => mergePageParams(bridgeParams.value, route.query))

  async function load(): Promise<void> {
    settled.value = false
    bridgeParams.value = {}

    const fetched = await fetchPageParams(
      { supported: isSupportBridge(), whenReady: whenWebviewBridge },
      route.path,
      params,
    )
    bridgeParams.value = fetched

    const token = mergePageParams(fetched, route.query)['access-token']
    if (token) accessToken.value = token
    if (fetched['access-token']) persistTokenForDebug(fetched['access-token'])
    // Native also owns the app's own theme and language; the route query outranks
    // them at the read site, so only what native actually answered lands here.
    if (fetched.theme) nativeTheme.value = fetched.theme
    if (fetched.lang) nativeLang.value = fetched.lang

    settled.value = true
  }

  onMounted(() => {
    void load()
  })

  return { params: values, settled, reload: load }
}
