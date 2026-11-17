#!/usr/bin/env node
// Send an arbitrary WebKit inspector method to a physical iPhone's H5 page.
//
//   node send-ios.mjs <method> '<params-json>' [--out <path>]
//   IOS_WEBVIEW_WS=ws://127.0.0.1:9222/devtools/page/1 node send-ios.mjs ...
//
// The proxy socket still carries a WebKit target layer: commands travel inside
// Target.sendMessageToTarget and replies arrive as Target.dispatchMessageFromTarget.
// Attach to targetInfo.type "page" (not "frame"), then send the method inside.
//
// When the reply carries a dataURL (or base64 data, as Page.snapshotRect does),
// the image is written to --out or to apps/website/.tmp/verify/ios-native/.

import fs from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..')
const LIST_URL = 'http://127.0.0.1:9222/json/list'
const TIMEOUT_MS = 30_000

const argv = process.argv.slice(2)
const outFlag = argv.indexOf('--out')
const outValue = outFlag === -1 ? null : argv[outFlag + 1]
const positional = outFlag === -1 ? argv : [...argv.slice(0, outFlag), ...argv.slice(outFlag + 2)]
const method = positional[0]
const paramsRaw = positional[1] ?? '{}'

if (!method) {
  console.error("usage: node send-ios.mjs <method> '<params-json>' [--out <path>]")
  process.exit(2)
}
if (outFlag !== -1 && !outValue) {
  console.error('--out needs a file path')
  process.exit(2)
}

let params
try {
  params = JSON.parse(paramsRaw)
} catch (error) {
  console.error(`invalid params JSON: ${error.message}`)
  process.exit(2)
}

function defaultOutPath() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return resolve(repoRoot, 'apps/website/.tmp/verify/ios-native', `snapshot-${stamp}.png`)
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

function saveImage(dataUrl, outPath) {
  fs.mkdirSync(dirname(outPath), { recursive: true })
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl
  fs.writeFileSync(outPath, Buffer.from(base64, 'base64'))
  return outPath
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
    const inner = { id: 100, method, params }
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
    settle(1)
    return
  }

  const result = inner.result
  const dataUrl = result?.dataURL ?? (result?.data ? `data:image/png;base64,${result.data}` : null)
  if (dataUrl) {
    const outPath = outValue ? resolve(outValue) : defaultOutPath()
    settle(0, saveImage(dataUrl, outPath))
    return
  }

  if (outValue) console.error(`reply has no dataURL/data; nothing written to ${outValue}`)
  const text = JSON.stringify(result ?? null, null, 2)
  settle(0, text.length > 8000 ? `${text.slice(0, 8000)}\n...[truncated]` : text)
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
