import { onScopeDispose } from 'vue'

interface NetworkEvent {
  type: 'network'
  method: string
  url: string
  status?: number
  duration: number
  error?: string
  requestBody?: unknown
  responseBody?: unknown
}

export function isWebviewDebug(): boolean {
  return document.querySelector('meta[name="vois-webview-debug"]') !== null
}

export function redactUrl(input: RequestInfo | URL, base?: string): string {
  const raw = input instanceof Request ? input.url : String(input)
  const resolved =
    typeof base === 'string' ? new URL(raw, base) : new URL(raw, window.location.href)
  return resolved.href
}

/** Captures application fetch metadata until the current Vue scope is disposed. */
export function useWebviewDebug(enabled: boolean): void {
  if (!enabled) return

  const originalFetch = window.fetch.bind(window)
  const report = (event: NetworkEvent): void => {
    void originalFetch('/__debug/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => undefined)
  }

  // ponyail: monkey-patch fetch for debug; restores on scope dispose
  window.fetch = async (input, init) => {
    const url = redactUrl(input)
    if (new URL(url).pathname.startsWith('/__debug/')) return originalFetch(input, init)

    const startedAt = performance.now()
    const method = init?.method || (input instanceof Request ? input.method : 'GET')

    let requestBody: unknown
    if (init?.body) {
      if (typeof init.body === 'string') {
        try {
          requestBody = JSON.parse(init.body)
        } catch {
          requestBody = init.body
        }
      }
    }

    try {
      const response = await originalFetch(input, init)
      const cloned = response.clone()
      let responseBody: unknown
      try {
        const text = await cloned.text()
        try {
          responseBody = JSON.parse(text)
        } catch {
          responseBody = text
        }
      } catch {
        /* ignore body read errors */
      }

      report({
        type: 'network',
        method,
        url,
        status: response.status,
        duration: Math.round(performance.now() - startedAt),
        requestBody,
        responseBody,
      })
      return response
    } catch (error) {
      report({
        type: 'network',
        method,
        url,
        duration: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : String(error),
        requestBody,
      })
      throw error
    }
  }

  onScopeDispose(() => {
    window.fetch = originalFetch
  })
}
