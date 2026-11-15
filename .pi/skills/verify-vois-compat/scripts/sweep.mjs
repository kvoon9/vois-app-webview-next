import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureBrowserFor, SWEEP_ROOT } from './resolve.mjs'

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url)).replace(/\/$/, '')
// The bridge capture keeps events.jsonl Chrome 70-parsable; console and network
// are read over CDP instead, which this sweep already enables.
const DEFAULT_URL = 'http://127.0.0.1:8081/?capture=bridge#/devices'
const EVENTS_PATH = join(REPO_ROOT, 'apps/website/.tmp/vois-webview-debug/events.jsonl')

const SYNTAX_PATTERN =
  /SyntaxError|Unexpected token|Unexpected reserved word|Unexpected identifier|Invalid or unexpected token|Unexpected end of input|Unexpected number|Unexpected string/i
// A rendered device row, not merely an app shell. Case-insensitive so the
// English build satisfies the same predicate as the Chinese one.
const TEXT_PATTERN = /wl\d{6,}|CF03|电量|Battery/i

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

function exited(child) {
  return child.exitCode !== null || child.signalCode !== null
}

function stopBrowser(child) {
  if (!child || exited(child)) return Promise.resolve()
  try {
    child.kill('SIGTERM')
  } catch {}
  return sleep(1500).then(() => {
    if (exited(child)) return
    try {
      child.kill('SIGKILL')
    } catch {}
  })
}

function logTail(path, lines = 12) {
  try {
    return readFileSync(path, 'utf8').trim().split('\n').slice(-lines).join('\n')
  } catch {
    return ''
  }
}

function websocketClient(socket) {
  let nextId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const settle = pending.get(message.id)
      pending.delete(message.id)
      settle(message)
    }
  })
  return (method, params = {}, timeoutMs = 15000) =>
    new Promise((settle, fail) => {
      const id = ++nextId
      const timer = setTimeout(() => {
        pending.delete(id)
        fail(new Error(`CDP timeout: ${method}`))
      }, timeoutMs)
      pending.set(id, (message) => {
        clearTimeout(timer)
        settle(message)
      })
      socket.send(JSON.stringify({ id, method, params }))
    })
}

function connect(url) {
  return new Promise((settle, fail) => {
    const socket = new WebSocket(url)
    const timer = setTimeout(() => fail(new Error('websocket open timeout')), 5000)
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timer)
        settle(socket)
      },
      { once: true },
    )
    socket.addEventListener(
      'error',
      () => {
        clearTimeout(timer)
        fail(new Error('websocket error'))
      },
      { once: true },
    )
  })
}

/** `--remote-debugging-port=0` writes the chosen port beside the fresh profile. */
async function waitForDevTools(profileDir, child, timeoutMs = 20000) {
  const portFile = join(profileDir, 'DevToolsActivePort')
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (exited(child)) {
      throw new Error(
        `browser exited early with ${child.exitCode ?? child.signalCode ?? 'unknown'}`,
      )
    }
    try {
      const [port, path] = readFileSync(portFile, 'utf8').trim().split('\n')
      if (port && path) {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`)
        if (response.ok) return { port: Number(port), version: await response.json() }
      }
    } catch {}
    await sleep(250)
  }
  throw new Error(`DevTools endpoint did not answer in ${timeoutMs}ms`)
}

function truncated(values, limit = 20, chars = 600) {
  return values
    .slice(0, limit)
    .map((value) => (value.length > chars ? `${value.slice(0, chars)}...` : value))
}

function bridgeErrcode(data) {
  if (data === null || data === undefined || Array.isArray(data)) return null
  return Number.isFinite(data.errcode) ? data.errcode : null
}

/** Bridge events the page sent after `since`, reduced to timeline fields. */
function readBridgeEvents(eventsFile, since) {
  const events = []
  let malformed = 0
  let present = true
  let lines = []
  try {
    lines = readFileSync(eventsFile, 'utf8').split('\n')
  } catch {
    present = false
  }
  for (const line of lines) {
    if (!line.trim()) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      malformed += 1
      continue
    }
    if (event.type !== 'bridge' || (event.receivedAt ?? 0) < since) continue
    events.push({
      receivedAt: event.receivedAt ?? null,
      direction: event.direction ?? null,
      protocol: event.protocol ?? null,
      errcode: bridgeErrcode(event.data),
    })
  }
  return { present, malformed, events }
}

/** Protocol and direction groups with counts, errcodes, and their time span. */
function summarizeBridge(events) {
  const groups = new Map()
  const errcodes = {}
  for (const event of events) {
    const protocol = event.protocol ?? '?'
    const direction = event.direction ?? '?'
    const key = `${protocol}\u0000${direction}`
    const group = groups.get(key)
    if (group) {
      group.count += 1
      group.lastAt = event.receivedAt
    } else {
      groups.set(key, {
        protocol,
        direction,
        count: 1,
        firstAt: event.receivedAt,
        lastAt: event.receivedAt,
      })
    }
    if (event.errcode !== null) errcodes[event.errcode] = (errcodes[event.errcode] ?? 0) + 1
  }
  return { count: events.length, groups: [...groups.values()], errcodes }
}

async function evaluateJson(send, expression) {
  const message = await send('Runtime.evaluate', { expression, returnByValue: true })
  if (message.error) throw new Error(message.error.message)
  const value = message.result?.result?.value
  if (value === undefined || value === null) {
    throw new Error(message.result?.exceptionDetails?.text ?? 'empty evaluation result')
  }
  return JSON.parse(value)
}

const STATE_EXPRESSION = `JSON.stringify({
  ua: navigator.userAgent,
  href: location.href,
  title: document.title,
  hasApp: Boolean(document.querySelector('#app')),
  errorPage: (document.body ? document.body.innerText : '').includes('出了点问题'),
  text: (document.body ? document.body.innerText : '').slice(0, 4000),
  heading: ((document.querySelector('header') || {}).innerText || '').trim().slice(0, 80),
  listRows: document.querySelectorAll('ul li').length,
  buttons: document.querySelectorAll('button').length,
  debugClient: Boolean(document.querySelector('script[src*="/__debug/client.js"]')),
  captureMode: window.__voisDebugCapture || 'unknown',
  viewport: { width: window.innerWidth, height: window.innerHeight },
  scrollWidth: document.documentElement.scrollWidth,
  horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
})`

async function waitForState(send, waitMs) {
  const startedAt = Date.now()
  let state = {}
  let lastError = ''
  while (Date.now() - startedAt < waitMs) {
    try {
      state = await evaluateJson(send, STATE_EXPRESSION)
      lastError = ''
    } catch (error) {
      lastError = error.message
    }
    if (state.hasApp && !state.errorPage && TEXT_PATTERN.test(state.text ?? '')) break
    await sleep(500)
  }
  return { state, waitedMs: Date.now() - startedAt, lastError }
}

function classify(keptExceptions, keptLogEntries, networkFailures) {
  const errorTexts = [
    ...keptExceptions,
    ...keptLogEntries.filter((entry) => entry.level === 'error').map((entry) => entry.text),
  ]
  if (errorTexts.some((text) => SYNTAX_PATTERN.test(text))) return 'syntax'
  if (keptExceptions.length > 0) return 'runtime'
  if (networkFailures.length > 0) return 'network'
  return 'none'
}

export async function runSweep({
  major,
  appUrl = DEFAULT_URL,
  outDir = join(REPO_ROOT, 'apps/website/.tmp/verify/compat/legacy', String(major)),
  waitMs = Number(process.env.WAIT_MS ?? 30000),
  profileRoot = join(SWEEP_ROOT, 'profiles', 'compat'),
  eventsFile = EVENTS_PATH,
  browser,
} = {}) {
  const resolved = browser ?? (await ensureBrowserFor(major))
  const profileDir = join(profileRoot, String(major))
  const logPath = join(outDir, `${major}.chrome.log`)
  const screenshotPath = join(outDir, `${major}.png`)
  const appOrigin = new URL(appUrl).origin
  mkdirSync(outDir, { recursive: true })
  rmSync(profileDir, { recursive: true, force: true })
  mkdirSync(profileDir, { recursive: true })

  const base = {
    requestedMajor: major,
    actualVersion: resolved.binaryVersion,
    ua: '',
    pass: false,
    classification: 'none',
    checks: {},
    layout: {},
    exceptions: [],
    logEntries: [],
    networkFailures: [],
    bridge: { present: false, count: 0, summary: {}, events: [] },
    screenshot: '',
    waitedMs: 0,
    notes: '',
  }
  const noteParts = [
    resolved.cached ? 'browser cached' : `snapshot r${resolved.snapshotRevision}`,
    'headless',
  ]

  const spawnBrowser = (append) => {
    const logFd = openSync(logPath, append ? 'a' : 'w')
    const child = spawn(
      resolved.binary,
      [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-dev-shm-usage',
        '--lang=zh-CN',
        '--remote-debugging-port=0',
        `--user-data-dir=${profileDir}`,
        'about:blank',
      ],
      { detached: true, stdio: ['ignore', logFd, logFd] },
    )
    closeSync(logFd)
    child.unref()
    return child
  }

  let child = spawnBrowser(false)
  let socket
  let launched = false
  try {
    let devtools
    try {
      devtools = await waitForDevTools(profileDir, child)
    } catch {
      await stopBrowser(child)
      rmSync(profileDir, { recursive: true, force: true })
      mkdirSync(profileDir, { recursive: true })
      child = spawnBrowser(true)
      devtools = await waitForDevTools(profileDir, child)
      noteParts.push('launch retried once after CDP startup failure')
    }
    launched = true
    const { port, version } = devtools
    base.actualVersion =
      (version.Browser ?? '').replace(/^HeadlessChrome\//, '') || resolved.binaryVersion

    // Headless Chrome answers /json/version before it lists its first page.
    let page
    const pageDeadline = Date.now() + 10000
    while (!page && Date.now() < pageDeadline) {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      page = targets.find((target) => target.type === 'page')
      if (!page) await sleep(250)
    }
    if (!page) throw new Error('no page target')

    socket = await connect(page.webSocketDebuggerUrl)
    const send = websocketClient(socket)
    const exceptions = []
    const logEntries = []
    const networkFailures = []
    const requestUrls = new Map()

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails
        const text = details.exception?.description ?? details.text
        const position = Number.isInteger(details.lineNumber)
          ? `:${details.lineNumber + 1}:${details.columnNumber + 1}`
          : ''
        const location = details.url ? ` (${details.url}${position})` : ''
        exceptions.push(`${text}${location}`)
      }
      if (message.method === 'Log.entryAdded') {
        const entry = message.params.entry
        logEntries.push({
          level: entry.level,
          source: entry.source,
          text: entry.text,
          url: entry.url ?? '',
        })
      }
      if (message.method === 'Network.requestWillBeSent') {
        requestUrls.set(message.params.requestId, message.params.request.url)
      }
      if (message.method === 'Network.responseReceived') {
        const { response, requestId } = message.params
        const url = response.url ?? requestUrls.get(requestId) ?? ''
        if (response.status >= 400 && url.startsWith(appOrigin) && !url.endsWith('/favicon.ico')) {
          networkFailures.push(`${response.status} ${url}`)
        }
      }
      if (message.method === 'Network.loadingFailed') {
        const url = requestUrls.get(message.params.requestId) ?? ''
        if (message.params.errorText !== 'net::ERR_ABORTED' && url.startsWith(appOrigin)) {
          networkFailures.push(`${message.params.errorText} ${url}`)
        }
      }
    })

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Log.enable')
    await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    })
    const runStartedAt = Date.now()
    await send('Page.navigate', { url: appUrl })

    const { state, waitedMs, lastError } = await waitForState(send, waitMs)
    const bridge = readBridgeEvents(eventsFile, runStartedAt)
    const bridgeSummary = summarizeBridge(bridge.events)
    base.bridge = {
      present: bridge.present,
      count: bridge.events.length,
      malformed: bridge.malformed,
      summary: bridgeSummary,
      events: bridge.events,
    }
    base.waitedMs = waitedMs
    base.layout = {
      viewport: state.viewport ?? {},
      scrollWidth: state.scrollWidth ?? 0,
      horizontalOverflow: state.horizontalOverflow ?? false,
      heading: state.heading ?? '',
      listRows: state.listRows ?? 0,
      buttons: state.buttons ?? 0,
    }

    const screenshot = await send('Page.captureScreenshot', { format: 'png' })
    if (screenshot.result?.data) {
      writeFileSync(screenshotPath, Buffer.from(screenshot.result.data, 'base64'))
      base.screenshot = relative(REPO_ROOT, screenshotPath)
    }

    const keptExceptions = truncated(
      exceptions.filter((text) => !text.includes('import.meta.resolve not supported')),
    )
    const keptLogEntries = logEntries
      .filter((entry) => !entry.text.includes('import.meta.resolve not supported'))
      .slice(0, 20)
      .map((entry) => ({
        level: entry.level,
        source: entry.source,
        text: entry.text.length > 600 ? `${entry.text.slice(0, 600)}...` : entry.text,
        url: entry.url,
      }))
    const keptNetworkFailures = [...new Set(networkFailures)].slice(0, 20)

    const classification = classify(keptExceptions, keptLogEntries, keptNetworkFailures)
    const uaMatches = (state.ua ?? '').includes(`Chrome/${major}.`)
    const textMatches = TEXT_PATTERN.test(state.text ?? '')
    const checks = {
      uaMatches,
      appRoot: state.hasApp === true,
      noErrorPage: state.errorPage === false,
      debugClient: state.debugClient === true,
      bridgeMode: state.captureMode === 'bridge',
      bridgeCaptured: bridge.events.length > 0,
      dataRow: textMatches,
      noAppExceptions: keptExceptions.length === 0,
      noAppAssetFailures: keptNetworkFailures.length === 0,
      headingVisible: (state.heading ?? '').length > 0,
      listRows: (state.listRows ?? 0) > 0,
      buttons: (state.buttons ?? 0) > 0,
      noHorizontalOverflow: state.horizontalOverflow === false,
    }
    const pass = Object.values(checks).every(Boolean)

    if (state.debugClient) noteParts.push('debug client injected')
    noteParts.push(
      `capture mode ${state.captureMode ?? 'unknown'}`,
      `bridge events ${bridge.events.length}`,
    )
    if (!bridge.present) noteParts.push('events file not found')
    if (bridge.malformed > 0)
      noteParts.push(`malformed capture lines skipped (${bridge.malformed})`)
    if (keptNetworkFailures.length > 0) {
      noteParts.push(`network failures: ${keptNetworkFailures.join('; ')}`)
    }
    if (!textMatches) {
      noteParts.push(`body text: ${JSON.stringify((state.text ?? '').slice(0, 200))}`)
    }
    if (!uaMatches) noteParts.push(`unexpected UA: ${state.ua ?? 'empty'}`)
    if (classification !== 'none') {
      const first =
        keptExceptions[0] ?? keptLogEntries.find((entry) => entry.level === 'error')?.text
      noteParts.push(`first error: ${JSON.stringify(first ?? '')}`)
    }
    if (lastError) noteParts.push(`last evaluation error: ${lastError}`)

    base.ua = state.ua ?? ''
    base.pass = pass
    base.classification = classification
    base.checks = checks
    base.exceptions = keptExceptions
    base.logEntries = keptLogEntries
    base.networkFailures = keptNetworkFailures
    base.notes = noteParts.join('; ')
    return base
  } catch (error) {
    base.classification = launched ? 'probe-error' : 'launch-error'
    base.notes = [
      `harness limit: ${launched ? 'probe failed' : 'launch failed'}: ${error.message}`,
      logTail(logPath) && `chrome log: ${logTail(logPath)}`,
    ]
      .filter(Boolean)
      .join('; ')
    return base
  } finally {
    if (socket) socket.close()
    await stopBrowser(child)
  }
}

export function writeResults(outDir, rows) {
  mkdirSync(outDir, { recursive: true })
  const resultsPath = join(outDir, 'results.json')
  writeFileSync(resultsPath, `${JSON.stringify(rows, null, 2)}\n`)
  return resultsPath
}

function option(argv, name, fallback) {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  const milestoneArg = option(argv, 'milestones', process.env.MILESTONES ?? '70')
  const majors = milestoneArg
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
  const appUrl = option(argv, 'url', process.env.APP_URL ?? DEFAULT_URL)
  const waitMs = Number(option(argv, 'wait', process.env.WAIT_MS ?? '30000'))
  const eventsFile = option(argv, 'events-file', process.env.VOIS_DEBUG_EVENTS_FILE ?? EVENTS_PATH)
  const outputRoot = resolve(
    option(argv, 'out-root', join(REPO_ROOT, 'apps/website/.tmp/verify/compat/legacy')),
  )

  const rows = []
  for (const major of majors) {
    const outDir = join(outputRoot, String(major))
    const row = await runSweep({ major, appUrl, waitMs, outDir, eventsFile })
    rows.push(row)
    const resultsPath = writeResults(outDir, [row])
    console.log(
      `${major}: ${row.pass ? 'PASS' : 'FAIL'} ${row.classification} ${row.actualVersion}${
        row.notes ? ` (${row.notes.slice(0, 140)})` : ''
      }`,
    )
    console.log(`results: ${resultsPath}`)
  }
}
