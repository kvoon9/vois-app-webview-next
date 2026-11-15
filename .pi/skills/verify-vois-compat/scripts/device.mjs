import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url)).replace(/\/$/, '')
const EVENTS_PATH = join(REPO_ROOT, 'apps/website/.tmp/vois-webview-debug/events.jsonl')
const DEFAULT_PORTS = [3021, 5173, 8081]
const MAX_CAPTURE_BYTES = 50 * 1024 * 1024

function portsFromArgv(argv) {
  const ports = []
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--port' && argv[index + 1]) ports.push(Number(argv[index + 1]))
  }
  return ports.filter((port) => Number.isInteger(port) && port > 0)
}

async function debugStatus(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/__debug/status`, {
      signal: AbortSignal.timeout(1500),
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function tryJson(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/** Counts non-zero errcodes from a network body or a bridge reply. */
function checkErrcode(body, errcodes) {
  if (body && Number.isFinite(body.errcode) && body.errcode !== 0) {
    errcodes[body.errcode] = (errcodes[body.errcode] ?? 0) + 1
  }
}

function summarizeCapture() {
  if (!existsSync(EVENTS_PATH)) {
    return { present: false, path: 'apps/website/.tmp/vois-webview-debug/events.jsonl' }
  }
  const sizeBytes = statSync(EVENTS_PATH).size
  if (sizeBytes > MAX_CAPTURE_BYTES) {
    return {
      present: true,
      path: 'apps/website/.tmp/vois-webview-debug/events.jsonl',
      sizeBytes,
      skipped: `larger than ${MAX_CAPTURE_BYTES} bytes`,
    }
  }

  const lines = readFileSync(EVENTS_PATH, 'utf8').split('\n').filter(Boolean)
  const counts = { lifecycle: 0, network: 0, console: 0, error: 0, bridge: 0, other: 0 }
  const bridgeDirections = {}
  const bridgeProtocols = new Set()
  const errcodes = {}
  const recent = []

  for (const line of lines) {
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    const type = event.type ?? 'other'
    counts[type] = (counts[type] ?? 0) + 1
    const summary = { at: event.receivedAt ?? null, type }
    if (type === 'bridge') {
      const direction = event.direction ?? 'unknown'
      bridgeDirections[direction] = (bridgeDirections[direction] ?? 0) + 1
      const protocol = event.protocol ?? event.data?.type
      if (protocol) bridgeProtocols.add(String(protocol))
      summary.direction = event.direction ?? null
      summary.protocol = protocol ?? null
      checkErrcode(event.data, errcodes)
      summary.errcode = event.data?.errcode ?? null
    }
    if (type === 'network') {
      const body = tryJson(event.responseBody)
      checkErrcode(body, errcodes)
      summary.method = event.method ?? null
      summary.status = event.status ?? null
      summary.errcode = body?.errcode ?? null
    }
    recent.push(summary)
  }

  return {
    present: true,
    path: 'apps/website/.tmp/vois-webview-debug/events.jsonl',
    sizeBytes,
    counts,
    bridgeDirections,
    bridgeProtocols: [...bridgeProtocols].sort((left, right) => left.localeCompare(right)),
    nonZeroErrcodes: errcodes,
    recent: recent.slice(-5),
  }
}

const acceptance = [
  'App root present; the page is not the 出了点问题 error screen.',
  'The debug pipeline is live: /__debug/status answers or the L3 native bridge connects.',
  'A device row matches wl\\d{6,}|CF03|电量|Battery, or the screen agrees with the captured response.',
  'No app exceptions and no app-asset 404s; in bridge capture mode console and network come from the inspector/CDP.',
  'UI at 375x812: header title, list, and buttons visible; no overlap and no horizontal overflow.',
  'Judge every reply by errcode, never by HTTP 200.',
]

const iosRunbook = [
  'Follow .pi/skills/verify-vois-native/SKILL.md; it owns the iOS procedure.',
  'Check the device: idevice_id -l; idevicedevmodectl list; sim-use ios-device devices --json.',
  'Start the inspect channel: ios_webkit_debug_proxy -u <UDID>, then curl -s http://127.0.0.1:9222/json/list.',
  'Open the debug entry in the app (debug server on :5173, LAN IP 192.168.1.87) with ?capture=bridge; read console and network over the inspector.',
  'Drive JS: node .pi/skills/verify-vois-native/scripts/eval-ios.mjs \'location.hash = "#/devices"\'.',
  'Capture: node .pi/skills/verify-vois-native/scripts/send-ios.mjs Page.snapshotRect \'{"x":0,"y":0,"width":414,"height":812,"coordinateSystem":"Viewport"}\' --out apps/website/.tmp/verify/compat/device/ios/device-list.png',
  'Prove bridge behavior from events.jsonl; iOS 5.0.6 cannot do get-location, get-permissions, write-clipboard, or WeChat app pay.',
]

const androidRunbook = [
  'Use the existing AndroMeld MCP flow; no new Android suite. See docs/device-management-status.md:113 and docs/device-management-verification.md.',
  'phone_connect with the task name, then phone_launch VoiChat.',
  'Drive 设备 tab -> device row -> detail with phone_observe / phone_tap. The element-tree frame divided by 1.9216 equals CSS px.',
  'Read apps/website/.tmp/vois-webview-debug/events.jsonl for bridge events (bridge mode keeps one load marker); network and console come from the inspector/CDP. Judge by errcode, not HTTP status.',
  'Writes (unbind, fence, reminder) only on a sacrificial test device, and restore it afterwards.',
  'Native location, permission prompts, and payment need the real app; the DevServer has only stubs.',
]

const argv = process.argv.slice(2)
const json = argv.includes('--json')
const ports = portsFromArgv(argv).length > 0 ? portsFromArgv(argv) : DEFAULT_PORTS

const servers = []
for (const port of ports) {
  const status = await debugStatus(port)
  if (status) servers.push({ port, ...status })
}

function sessionLabel(value) {
  return Number.isFinite(value) ? new Date(value).toISOString() : 'unknown'
}

const warnings = servers
  .filter((server) => server.count <= 1)
  .map(
    (server) =>
      `http://127.0.0.1:${server.port} has ${server.count} event(s); open the H5 page before trusting the capture`,
  )

const capture = summarizeCapture()
const report = {
  debugServers: servers,
  warnings,
  capture,
  acceptance,
  runbook: { ios: iosRunbook, android: androidRunbook },
}

if (json) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('Layer 3 device doctor\n')
  if (servers.length === 0) {
    console.log(
      `No debug server answered on ${ports.join(', ')}. Start one first: cd apps/website && vp dev --host --port 3021`,
    )
  } else {
    for (const server of servers) {
      console.log(
        `debug server http://127.0.0.1:${server.port}: ${server.count} event(s), ${server.sizeBytes} bytes, session ${sessionLabel(server.sessionStartedAt)}`,
      )
    }
    for (const warning of warnings) console.log(`warning: ${warning}`)
  }

  if (!capture.present) {
    console.log('capture: not created yet (a debug server truncates and creates it at startup)')
  } else if (capture.skipped) {
    console.log(`capture: skipped (${capture.skipped})`)
  } else {
    console.log(
      `capture: ${capture.counts.bridge} bridge, ${capture.counts.network} network, ${capture.counts.error} error events`,
    )
    if (capture.bridgeProtocols.length > 0) {
      console.log(`bridge protocols: ${capture.bridgeProtocols.join(', ')}`)
    }
    const errcodes = Object.entries(capture.nonZeroErrcodes)
    if (errcodes.length > 0) {
      console.log(
        `non-zero errcodes: ${errcodes.map(([code, count]) => `${code} x${count}`).join(', ')}`,
      )
    }
  }

  console.log('\nAcceptance')
  for (const line of acceptance) console.log(`- ${line}`)

  console.log('\niOS')
  for (const line of iosRunbook) console.log(`- ${line}`)

  console.log('\nAndroid (AndroMeld MCP)')
  for (const line of androidRunbook) console.log(`- ${line}`)

  console.log(
    '\nReal-phone driving stays with the agent through the native MCP/inspector channels.',
  )
}

process.exit(servers.length > 0 ? 0 : 1)
