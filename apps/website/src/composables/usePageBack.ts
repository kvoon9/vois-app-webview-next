import { nullish, number, object, optional, safeParse, string } from 'valibot'
import { useRouter, type HistoryState } from 'vue-router'

import { useWebviewBridge } from '~/composables/useWebviewBridge'

/**
 * The slice of `history.state` this module reads. Vue Router writes both fields on
 * every entry it creates; an entry the WebView host loaded has no state at all.
 */
const entrySchema = object({
  back: nullish(string()),
  position: optional(number()),
})

type HistoryStateValue = HistoryState[string]

/** Session index of the entry carrying `state`; 0 when the entry has no numbering. */
export function historyPosition(state: HistoryStateValue): number {
  const parsed = safeParse(entrySchema, state)
  return parsed.success ? (parsed.output.position ?? 0) : 0
}

/**
 * App pages the document can pop. Vue Router seeds `position` from `history.length`
 * when it adopts the document, so entries at or below `sessionStart` belong to the
 * WebView host, and a back press must not walk into them.
 */
export function historyDepth(state: HistoryStateValue, sessionStart: number): number {
  const parsed = safeParse(entrySchema, state)
  if (!parsed.success) return 0

  const { back, position } = parsed.output
  if (back == null || position == null) return 0
  return Math.max(0, position - sessionStart)
}

let sessionStart = 0

/** Call once, after the router is created and before the app mounts. */
export function markSessionStart(): void {
  sessionStart = historyPosition(window.history.state)
}

/**
 * Page header back: pop `steps` app pages, or ask native to close the WebView when
 * the document has fewer than that behind it. Leaving a group pops two, so the group
 * list that led into it does not linger in front of the page the user came from.
 */
export function usePageBack() {
  const router = useRouter()

  function goBack(steps = 1): void {
    const depth = historyDepth(window.history.state, sessionStart)
    if (depth === 0) {
      useWebviewBridge()?.send('close-page')
      return
    }

    router.go(-Math.min(steps, depth))
  }

  return { goBack }
}
