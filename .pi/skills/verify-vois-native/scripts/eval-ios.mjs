#!/usr/bin/env node
// Evaluate an expression inside a physical iPhone's H5 page target.
//
//   node eval-ios.mjs '<expression>'
//   IOS_WEBVIEW_WS=ws://127.0.0.1:9222/devtools/page/1 node eval-ios.mjs '<expression>'
//
// The proxy socket still carries a WebKit target layer: commands travel inside
// Target.sendMessageToTarget and replies arrive as Target.dispatchMessageFromTarget.
// Attach to targetInfo.type "page" (not "frame"), then send Runtime.evaluate inside.

import process from 'node:process'

const LIST_URL = 'http://127.0.0.1:9222/json/list'
const TIMEOUT_MS = 30_000

const expression = process.argv.slice(2).join(' ')
if (!expression) {
  console.error('usage: node eval-ios.mjs <expression>')
  process.exit(2)
}

async function discoverSocket() {
  const override = process.env.IOS_WEBVIEW_WS
  if (override) return override

  let targets
  try {
    const response = await fetch(LIST_URL, { signal: AbortSignal.timeout(5000) })
    targets = await response.json()
  } catch (error) {
    console.error(`cannot reach ${LIST_URL}: ${error.cause?.code ?? error.message}`)
    console.error('start the proxy first: ios_webkit_debug_proxy -u <UDID>')
    process.exit(1)
  }

  const target = Array.isArray(targets)
    ? targets.find((entry) => entry?.webSocketDebuggerUrl)
    : null
  if (!target) {
    console.error(`no WebKit page target at ${LIST_URL}`)
    console.error('is an H5 page open in a Debug build with WKWebView.isInspectable = true?')
    console.error(
      'restart the app after enabling Settings > Apps > Safari > Advanced > Web Inspector',
    )
    process.exit(1)
  }
  return target.webSocketDebuggerUrl
}

const socketUrl = await discoverSocket()
const socket = new WebSocket(socketUrl)
let settled = false
let sent = false
let pageTargetId = null

const timer = setTimeout(() => {
  settle(1, `TIMEOUT after ${TIMEOUT_MS / 1000}s: the page target never answered`)
}, TIMEOUT_MS)

function settle(code, output) {
  if (settled) return
  settled = true
  clearTimeout(timer)
  if (output !== undefined) console.log(output)
  socket.close()
  process.exit(code)
}

function parseInner(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

socket.addEventListener('message', (event) => {
  const raw = String(event.data)
  let message
  try {
    message = JSON.parse(raw)
  } catch {
    console.error(`ignoring non-JSON frame: ${raw.slice(0, 200)}`)
    return
  }

  if (message.method === 'Target.targetCreated' && !sent) {
    const info = message.params?.targetInfo
    if (info?.type !== 'page') return
    sent = true
    pageTargetId = info.targetId
    const inner = {
      id: 100,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true, awaitPromise: true },
    }
    socket.send(
      JSON.stringify({
        id: 1,
        method: 'Target.sendMessageToTarget',
        params: { targetId: pageTargetId, message: JSON.stringify(inner) },
      }),
    )
    return
  }

  if (message.method !== 'Target.dispatchMessageFromTarget') return
  if (pageTargetId !== null && message.params?.targetId !== pageTargetId) return

  const inner = parseInner(message.params?.message)
  if (inner === null) {
    settle(1, 'could not parse the inner inspector reply')
    return
  }
  if (inner.id !== 100) return
  if (inner.error) {
    console.error('INSPECTOR_ERROR', JSON.stringify(inner.error))
    settle(1, undefined)
    return
  }
  if (inner.exceptionDetails) {
    const description = inner.exceptionDetails.exception?.description ?? inner.exceptionDetails.text
    settle(1, `EXCEPTION ${description}`)
    return
  }

  const result = inner.result?.result
  if (result === undefined || result === null) {
    settle(1, `unexpected reply: ${JSON.stringify(inner)}`)
    return
  }
  if (result.type === 'string') {
    settle(0, result.value)
  } else if (Object.hasOwn(result, 'value')) {
    settle(0, JSON.stringify(result.value))
  } else {
    settle(0, JSON.stringify(result))
  }
})

socket.addEventListener('error', () => {
  console.error(`WebSocket error on ${socketUrl}`)
  console.error('check that the proxy is running and the page target still exists')
  settle(1)
})

socket.addEventListener('close', () => {
  if (!settled) {
    console.error('connection closed before a reply')
    settle(1)
  }
})
