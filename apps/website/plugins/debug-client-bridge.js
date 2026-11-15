// Chrome 70 parses this file, so it uses no optional chaining and no nullish
// coalescing. capture-debug-client.ts prepends the plugin's full client source
// as `voisFullDebugClientSource`; a page without `?capture=bridge` runs it.
/* oxlint-disable anti-slop/no-runtime-typeof -- This client validates untyped
   CustomEvent details and serializes arbitrary values at the browser boundary,
   where no schema library is available. */
;(function () {
  var bridgeEventName = 'vois-webview-debug'
  var eventsPath = '/__debug/events'

  function hasBridgeCapture(query) {
    return new URLSearchParams(query).get('capture') === 'bridge'
  }

  function captureMode() {
    if (hasBridgeCapture(window.location.search)) return 'bridge'
    var hash = window.location.hash
    var queryAt = hash.indexOf('?')
    if (queryAt !== -1 && hasBridgeCapture(hash.slice(queryAt + 1))) return 'bridge'
    return 'full'
  }

  /**
   * The default capture must start before the app's modules so it sees their
   * first calls. An inserted module tag would load asynchronously; an inline
   * classic script runs synchronously at insertion.
   */
  function runFullClient(source) {
    var executable = source.replace(/^export \{\};[ \t]*$/m, '')
    var script = document.createElement('script')
    script.textContent = '"use strict";' + executable
    document.head.appendChild(script)
    document.head.removeChild(script)
  }

  function serializeEvent(event) {
    var seen = new WeakSet()
    try {
      return JSON.stringify(event, function (_key, value) {
        if (typeof value === 'bigint') return value.toString()
        if (value instanceof Error) {
          return { name: value.name, message: value.message, stack: value.stack }
        }
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]'
          seen.add(value)
        }
        return value
      })
    } catch {
      return undefined
    }
  }

  function sendEvent(event) {
    var body = serializeEvent(event)
    if (!body) return
    window
      .fetch(eventsPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
      })
      .catch(function () {})
  }

  function isBridgeEvent(value) {
    return (
      typeof value === 'object' &&
      value !== null &&
      value.type === 'bridge' &&
      (value.direction === 'send' || value.direction === 'receive') &&
      typeof value.protocol === 'string'
    )
  }

  function captureBridge() {
    window.addEventListener(bridgeEventName, function (event) {
      if (!(event instanceof CustomEvent) || !isBridgeEvent(event.detail)) return
      sendEvent(event.detail)
    })
    sendEvent({
      type: 'lifecycle',
      event: 'load',
      url: window.location.href,
      title: document.title,
    })
    console.log('🟢 WebView debug connected')
  }

  var mode = captureMode()
  // Lets the compat sweep prove the page took the bridge branch, not the full one.
  window.__voisDebugCapture = mode
  if (mode === 'bridge') captureBridge()
  else runFullClient(voisFullDebugClientSource)
})()
