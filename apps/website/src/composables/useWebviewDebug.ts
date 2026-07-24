import { onScopeDispose } from 'vue'

type DebugEvent = NetworkEvent | ConsoleEvent | ErrorEvent | LifecycleEvent

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

interface ConsoleEvent {
  type: 'console'
  level: 'log' | 'warn' | 'error'
  args: unknown[]
}

interface ErrorEvent {
  type: 'error'
  message: string
  source?: string
  lineno?: number
  colno?: number
  stack?: string
}

interface LifecycleEvent {
  type: 'lifecycle'
  event: 'load' | 'route' | 'visibility'
  url: string
  title: string
  visible?: boolean
}

export function isWebviewDebug(): boolean {
  return document.querySelector('meta[name="vois-webview-debug"]') !== null
}

function sendEvent(event: DebugEvent, fetchFn: typeof fetch): void {
  void fetchFn('/__debug/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  }).catch(() => undefined)
}

function hookConsole(report: (e: ConsoleEvent) => void): () => void {
  const levels = ['log', 'warn', 'error'] as const
  const originals = levels.map((l) => console[l])
  for (const level of levels) {
    console[level] = (...args: unknown[]) => {
      report({ type: 'console', level, args })
      originals[levels.indexOf(level)](...args)
    }
  }
  return () => {
    for (const [i, level] of levels.entries()) console[level] = originals[i]
  }
}

function hookErrors(report: (e: ErrorEvent) => void): () => void {
  const handleError = (e: Event): void => {
    const msg = e instanceof ErrorEvent ? e.message : e.type || 'Unknown error'
    report({
      type: 'error',
      message: msg,
      source: e instanceof ErrorEvent ? e.filename : undefined,
      lineno: e instanceof ErrorEvent ? e.lineno : undefined,
      colno: e instanceof ErrorEvent ? e.colno : undefined,
      stack: e instanceof ErrorEvent ? e.error?.stack : undefined,
    })
  }
  const onRejection = (e: PromiseRejectionEvent): void => {
    report({
      type: 'error',
      message: e.reason instanceof Error ? e.reason.message : String(e.reason),
      stack: e.reason instanceof Error ? e.reason.stack : undefined,
    })
  }
  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

function hookLifecycle(report: (e: LifecycleEvent) => void): () => void {
  const emit = () =>
    report({
      type: 'lifecycle',
      event: 'load',
      url: window.location.href,
      title: document.title,
    })
  const onRoute = () =>
    report({
      type: 'lifecycle',
      event: 'route',
      url: window.location.href,
      title: document.title,
    })
  const onVisibility = () =>
    report({
      type: 'lifecycle',
      event: 'visibility',
      url: window.location.href,
      title: document.title,
      visible: document.visibilityState === 'visible',
    })
  emit()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('popstate', onRoute)
  const originalPush = history.pushState.bind(history)
  history.pushState = (...args) => {
    const result = originalPush(...args)
    onRoute()
    return result
  }
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('popstate', onRoute)
    history.pushState = originalPush
  }
}

/** Captures fetch metadata, console, JS errors, and page lifecycle until the current Vue scope is disposed. */
export function useWebviewDebug(enabled: boolean): void {
  if (!enabled) return

  const originalFetch = window.fetch.bind(window)
  const report = (event: DebugEvent): void => sendEvent(event, originalFetch)

  const unhookConsole = hookConsole(report)
  const unhookErrors = hookErrors(report)
  const unhookLifecycle = hookLifecycle(report)

  // emit baseline events so the agent can verify the pipeline is working
  console.log('🟢 WebView debug connected')

  window.fetch = async (input, init) => {
    const raw = input instanceof Request ? input.url : String(input)
    const url =
      raw.startsWith('http') || raw.startsWith('/') ? new URL(raw, window.location.href).href : raw
    if (new URL(url, window.location.href).pathname.startsWith('/__debug/'))
      return originalFetch(input, init)

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
    unhookConsole()
    unhookErrors()
    unhookLifecycle()
  })
}
