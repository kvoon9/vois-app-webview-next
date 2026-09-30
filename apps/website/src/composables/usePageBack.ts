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

/**
 * Where the app's first entry sits in the WebView session. A reload of a deep entry
 * keeps that entry's state but not the app's own numbering, so the mark has to
 * outlive the document: without it a reloaded page counts the host's entries, and
 * `goBack(2)` would pop into whatever the host loaded before the app.
 */
const SESSION_START_KEY = 'page-back-session-start'

let sessionStart = 0

/** The mark this WebView session stored, or null on its first document. */
function storedSessionStart(): number | null {
  const stored = sessionStorage.getItem(SESSION_START_KEY)
  if (stored === null) return null

  const parsed = Number(stored)
  return Number.isInteger(parsed) ? parsed : null
}

/** Call once, after the router is created and before the app mounts. */
export function markSessionStart(): void {
  sessionStart = storedSessionStart() ?? historyPosition(window.history.state)
  sessionStorage.setItem(SESSION_START_KEY, String(sessionStart))
}

/**
 * Page header back: pop `steps` app pages, or ask native to close the WebView when
 * the document has fewer than that behind it. Leaving a group pops two, so the group
 * list that led into it does not linger in front of the page the user came from.
 */
export function usePageBack() {
  const router = useRouter()

  function goBack(steps = 1): void {
    // A `@click="goBack"` handler hands the click event in as the step count.
    const count = Number.isInteger(steps) ? steps : 1
    const depth = historyDepth(window.history.state, sessionStart)
    if (depth === 0) {
      useWebviewBridge()?.send('close-page')
      return
    }

    router.go(-Math.min(count, depth))
  }

  return { goBack }
}
