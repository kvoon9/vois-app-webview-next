import { isSupportBridge, type WebviewBridge } from '@vois/webview-bridge'
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
} from 'valibot'
import { computed, effectScope, shallowRef, watch, type ComputedRef, type ShallowRef } from 'vue'
import { useRoute, useRouter, type Router } from 'vue-router'
import { whenWebviewBridge } from '~/composables/useWebviewBridge'
import { nativeLang, nativeTheme } from '~/constants'
import { useCredentialSession } from '~/utils/auth'
import { ACCESS_TOKEN_TIMEOUT_MS } from '~/utils/bridge/constants'

/** Give up on an unanswered bridge request after this long; native's own budget. */
export const PAGE_PARAMS_TIMEOUT_MS = ACCESS_TOKEN_TIMEOUT_MS

/** Page params are flat string key/values by contract; nesting is out of scope. */
export interface PageParams {
  [key: string]: string
}

/** A read is pending until native answers; `error` tells why it did not. */
export type PageParamsStatus = 'pending' | 'ready' | 'error'

/** The app shell always needs native's theme + language. */
export const BASE_PAGE_PARAM_NAMES = ['theme', 'lang'] as const

/** Which kind of failure ended a read, so a caller can react to the reason. */
export type PageParamsErrorReason = 'timeout' | 'invalid' | 'native' | 'unavailable'

/** Every failed in-app read rejects with this, never a bare bridge error. */
export class PageParamsError extends Error {
  readonly reason: PageParamsErrorReason
  readonly nativeCode: number | undefined

  constructor(reason: PageParamsErrorReason, message: string, nativeCode?: number) {
    super(message)
    this.name = 'PageParamsError'
    this.reason = reason
    this.nativeCode = nativeCode
  }
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

const INVALID_MESSAGE = 'App 返回的页面参数格式不正确。'

/** Where the params come from; injectable so a read is testable without a WebView. */
export interface PageParamsBridgeSource {
  /** Whether this environment ever gets a native bridge; desktop never does. */
  supported: () => boolean
  /** Resolves with the ready bridge; never settles where `supported()` is false. */
  whenReady: () => Promise<WebviewBridge | undefined>
}

/**
 * One-shot read of native's page params for `page`. Outside the app the answer
 * is an empty bag, because desktop is a normal place to be, not a failure; a
 * read that started in the app and failed rejects {@link PageParamsError}.
 */
export async function fetchPageParams(
  source: PageParamsBridgeSource,
  page: string,
  params: readonly string[] = [],
  timeoutMs: number = PAGE_PARAMS_TIMEOUT_MS,
): Promise<PageParams> {
  if (!source.supported()) return {}

  let answer: unknown
  try {
    answer = await withTimeout(askNative(source, page, params), timeoutMs)
  } catch (failure) {
    if (failure instanceof PageParamsError) throw failure
    throw new PageParamsError('invalid', INVALID_MESSAGE)
  }

  if (answer === undefined) throw new PageParamsError('timeout', '获取页面参数超时，请重试。')

  const decoded = safeParse(pageParamsSchema, answer)
  if (!decoded.success) throw new PageParamsError('invalid', INVALID_MESSAGE)
  if (decoded.output.errcode !== 0) {
    throw new PageParamsError('native', 'App 无法提供页面参数，请重试。', decoded.output.errcode)
  }

  const values: PageParams = {}
  for (const [key, value] of Object.entries(decoded.output.data ?? {})) {
    // A value native could not read, or one the protocol forbids, has no
    // string form; leaving the key out is how the page sees "not provided".
    const scalar = safeParse(scalarSchema, value)
    if (scalar.success) values[key] = String(scalar.output)
  }
  return values
}

/**
 * The bridge's own `get-page-params` types drive both sides; only `data` is
 * decoded here. A missing bridge means the app never handed one over in time.
 */
async function askNative(source: PageParamsBridgeSource, page: string, params: readonly string[]) {
  const bridge = await source.whenReady()
  if (!bridge) throw new PageParamsError('unavailable', '请在 App 中打开本页面。')
  return bridge.request('get-page-params', {
    page,
    params: [...params],
  })
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

/** What {@link createPageParamsStore} owns; see `observe` for the fetch rules. */
export interface PageParamsStore {
  params: ShallowRef<PageParams>
  status: ShallowRef<PageParamsStatus>
  error: ShallowRef<PageParamsError | null>
  /** The page whose values this store holds; undefined before the first observe. */
  page: ShallowRef<string | undefined>
  /** Point the store at the page being shown and ask for its names. */
  observe(page: string, names?: readonly string[]): void
  /** Read the current page again; resolves once the new answer (or failure) landed. */
  reload(): Promise<void>
}

/**
 * Page params for one app session. `observe` is the only entry point pages use:
 * calls in the same tick share one bridge request, a page change drops the
 * previous page's values and ignores its late answer, and names that arrive
 * mid-read trigger one more read with the union, never a loop.
 */
export function createPageParamsStore(source: PageParamsBridgeSource): PageParamsStore {
  const params = shallowRef<PageParams>({})
  const status = shallowRef<PageParamsStatus>('pending')
  const error = shallowRef<PageParamsError | null>(null)

  const observedPage = shallowRef<string | undefined>()
  let requested = new Set<string>()
  // Every read gets its own generation; only the newest one may land.
  let fetchGeneration = 0
  let batched = false
  let inFlight = false
  let rerun = false
  let idleWaiters: Array<() => void> = []

  function observe(page: string, names: readonly string[] = []): void {
    let changed = false
    if (page !== observedPage.value) {
      retirePendingRead()
      observedPage.value = page
      params.value = {}
      status.value = 'pending'
      error.value = null
      requested = new Set()
      changed = true
    }
    for (const name of [...BASE_PAGE_PARAM_NAMES, ...names]) {
      if (requested.has(name)) continue
      requested.add(name)
      changed = true
    }
    if (changed) schedule()
  }

  function retirePendingRead(): void {
    fetchGeneration += 1
    inFlight = false
    rerun = false
  }

  function schedule(): void {
    if (inFlight) {
      rerun = true
      return
    }
    if (batched) return
    batched = true
    queueMicrotask(() => {
      batched = false
      void start()
    })
  }

  async function start(): Promise<void> {
    const page = observedPage.value
    if (page === undefined) return

    const readGeneration = ++fetchGeneration
    const names = [...requested]
    // A retry or rerun shows progress again; values already read stay readable.
    status.value = 'pending'
    inFlight = true
    try {
      const values = await fetchPageParams(source, page, names)
      if (!isCurrent(readGeneration, page)) return
      params.value = values
      status.value = 'ready'
      error.value = null
      // Native also owns the app's own theme and language; the shell reads them.
      if (values.theme) nativeTheme.value = values.theme
      if (values.lang) nativeLang.value = values.lang
    } catch (failure) {
      if (!isCurrent(readGeneration, page)) return
      error.value =
        failure instanceof PageParamsError
          ? failure
          : new PageParamsError('invalid', INVALID_MESSAGE)
      status.value = 'error'
    } finally {
      if (readGeneration === fetchGeneration) {
        inFlight = false
        if (rerun) {
          rerun = false
          void start()
        } else {
          resolveIdle()
        }
      }
    }
  }

  /** A read may land only while it is the newest one and its page is still shown. */
  function isCurrent(readGeneration: number, page: string): boolean {
    return readGeneration === fetchGeneration && page === observedPage.value
  }

  function whenIdle(): Promise<void> {
    return new Promise((resolve) => {
      idleWaiters.push(resolve)
    })
  }

  function resolveIdle(): void {
    const waiters = idleWaiters
    idleWaiters = []
    for (const resolve of waiters) resolve()
  }

  async function reload(): Promise<void> {
    if (observedPage.value === undefined) return
    // A pending read's answer must not land after the reload's: retire it now,
    // even before the new request goes out.
    retirePendingRead()
    const idle = whenIdle()
    schedule()
    await idle
  }

  return { params, status, error, page: observedPage, observe, reload }
}

/** What `usePageParams` hands the page. */
export interface PageParamsHandle {
  params: ComputedRef<PageParams>
  status: ShallowRef<PageParamsStatus>
  error: ShallowRef<PageParamsError | null>
  /** Ask native again; the page's retry button calls this. */
  reload: () => Promise<void>
}

/** The app's one bridge source; the debug bridge registers before any read. */
const defaultSource: PageParamsBridgeSource = {
  supported: isSupportBridge,
  whenReady: whenWebviewBridge,
}

// One store for the app: App.vue and the current page observe different name
// sets, and the store unions them into the same read.
const store = createPageParamsStore(defaultSource)

/** Page params for the current route; the route query is never a source. */
export function usePageParams(names: readonly string[] = []): PageParamsHandle {
  const route = useRoute()
  const { session } = useCredentialSession()

  // Registered once, at this component's setup. A component about to unmount
  // has no say in the next page: the next route's own consumers reset the store.
  store.observe(route.path, names)
  startSamePageRefresh(useRouter())

  return {
    params: computed(() => {
      if (!session.value) return store.params.value
      const values = { ...store.params.value }
      delete values['login-id']
      if (session.value.userId !== undefined) values['login-id'] = String(session.value.userId)
      return values
    }),
    status: store.status,
    error: store.error,
    reload: () => store.reload(),
  }
}

let samePageRefreshStarted = false

/**
 * One app-level watcher for a path that stays the same while its fullPath changes
 * (a native hash update, or a debug URL query edit): re-read the page's params
 * without re-registering names. A page change is owned by the next page's setup,
 * so a component about to unmount never pollutes it.
 */
function startSamePageRefresh(router: Router): void {
  if (samePageRefreshStarted) return
  samePageRefreshStarted = true

  effectScope(true).run(() => {
    watch(
      () => router.currentRoute.value.fullPath,
      () => {
        if (router.currentRoute.value.path === store.page.value) void store.reload()
      },
      { flush: 'pre' },
    )
  })
}
