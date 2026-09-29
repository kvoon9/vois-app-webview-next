import { number, object, optional, safeParse } from 'valibot'
import { shallowRef, type ShallowRef } from 'vue'
import { useRouter, type HistoryState } from 'vue-router'

/** Only the account override rides history: native cannot know the device flow's account. */
export interface H5NavigationContext {
  /** Device flow: selected device's userId, used as the account. */
  accountId?: number
}

export const H5_CONTEXT_STATE_KEY = 'h5Context'

const contextSchema = object({ accountId: optional(number()) })

const stateSchema = object({ [H5_CONTEXT_STATE_KEY]: optional(contextSchema) })

/** History state values are structured-cloned; `unknown` is the honest read but the lint forbids it. */
type HistoryStateValue = HistoryState[string]

/** Pure read; tolerates any history.state shape. */
export function readH5Context(state: HistoryStateValue): H5NavigationContext {
  const parsed = safeParse(stateSchema, state)
  return parsed.success ? { ...parsed.output[H5_CONTEXT_STATE_KEY] } : {}
}

/** A push's state option; vue-router merges it with the entry's own keys. */
export interface H5ContextState {
  state: HistoryState
}

export interface H5NavigationContextHandle {
  context: ShallowRef<H5NavigationContext>
  withContext: (patch?: Partial<H5NavigationContext>) => H5ContextState
}

/** Context keys; a patch that names one with `undefined` clears it. */
const CONTEXT_KEYS = ['accountId'] as const

/** Same merge as `withContext`, without the history read, so it is testable off-DOM. */
export function mergeH5Context(
  current: H5NavigationContext,
  patch?: Partial<H5NavigationContext>,
): H5ContextState {
  // Spreading makes the merged object an anonymous type, which TypeScript lets through
  // `HistoryState`; the context interface itself is not assignable.
  const merged = { ...current, ...patch }
  if (patch) {
    for (const key of CONTEXT_KEYS) {
      if (key in patch && patch[key] === undefined) delete merged[key]
    }
  }
  return { state: { [H5_CONTEXT_STATE_KEY]: merged } }
}

/**
 * Each history entry owns its context: a same-path push creates a new entry with its
 * own state, which the page reads again after `afterEach`; back/forward restore each
 * entry's own context, and a push without `withContext` carries none. A host that
 * recreates history instead of restoring it leaves the page with bridge launch params,
 * never another flow's account.
 */
function currentEntryContext(): H5NavigationContext {
  return readH5Context(window.history.state)
}

// Module level because two history entries can share a URL, so neither the route nor a
// per-component computed can key this; only the router refreshes it.
let currentContext: ShallowRef<H5NavigationContext> | undefined
let subscribed = false

export function useNavigationContext(): H5NavigationContextHandle {
  const router = useRouter()
  const context = (currentContext ??= shallowRef(currentEntryContext()))

  if (!subscribed) {
    subscribed = true
    router.afterEach((_to, _from, failure) => {
      if (failure) return
      context.value = currentEntryContext()
    })
  }

  // Reading history at call time keeps a same-URL push from reusing the entry's state.
  return { context, withContext: (patch) => mergeH5Context(currentEntryContext(), patch) }
}
