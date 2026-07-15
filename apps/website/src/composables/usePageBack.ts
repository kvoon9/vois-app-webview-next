import { useRouter } from 'vue-router'

import { useWebviewBridge } from '~/composables/useWebviewBridge'

/** Vue Router stores previous location on `history.state.back` when one exists. */
function canGoBackInHistory(): boolean {
  const state = window.history.state as { back?: unknown } | null
  return state != null && state.back != null
}

/**
 * Page header back: pop SPA history when possible, otherwise ask native to close the WebView.
 */
export function usePageBack() {
  const router = useRouter()

  function goBack(): void {
    if (canGoBackInHistory()) {
      router.back()
      return
    }

    useWebviewBridge()?.send('close-page')
  }

  return { goBack }
}
