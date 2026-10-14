#!/usr/bin/env node
// Read-only check: is the DevServer instance on the probe port worth driving?
//
//   node .pi/skills/verify-vois-webview/scripts/doctor.mjs [--port 3021] [--json]
//
// Answers five questions with the debug pipeline's own primitives:
//   1. Is a debug server answering /__debug/status?
//   2. Did a page load connect in *this* server session (the 🟢 marker)?
//   3. Does the served source predate the server session (staleness)?
//   4. Which worktree and revision is this, and is it dirty?
//   5. Did the last /v2 calls succeed, or is auth dead?
//
// It never drives the app, never writes, never prints tokens or signing params.
// Exit 0 = worth driving; exit 1 = the report says why not.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..')
const eventsFile = join(repoRoot, 'apps/website/.tmp/vois-webview-debug/events.jsonl')

const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const portIndex = argv.indexOf('--port')
const port = portIndex === -1 ? 3021 : Number(argv[portIndex + 1])

const problems = []
const warnings = []

function sh(command, args) {
  try {
    return execFileSync(command, args, { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

function readEvents() {
  if (!existsSync(eventsFile)) return []
  return readFileSync(eventsFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      const event = parseEvent(line)
      return event === null ? [] : [event]
    })
}

/** Credential-ish query parameters and keys, stripped before anything is printed. */
function scrub(value) {
  return value.replace(
    /([?&](?:token|sign|appid|access-token|key|password)=)[^&]*/gi,
    '$1<redacted>',
  )
}

/** A captured URL, or null when the string does not parse as one. */
function toUrl(value) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

/**
 * The debug server's session identity. Any payload without a numeric session start is
 * some other server that happens to answer on this port, so it parses to null.
 */
function parseStatus(payload) {
  if (!Number.isFinite(payload?.sessionStartedAt)) return null
  return {
    sessionStartedAt: payload.sessionStartedAt,
    count: Number(payload.count) || 0,
    sizeBytes: Number(payload.sizeBytes) || 0,
  }
}

/** One capture line reduced to the fields this doctor reads; unreadable lines drop out. */
function parseEvent(line) {
  let raw
  try {
    raw = JSON.parse(line)
  } catch {
    return null
  }
  const receivedAt = Number.isFinite(raw?.receivedAt) ? raw.receivedAt : null
  return {
    type: raw?.type,
    receivedAt,
    status: raw?.status,
    method: raw?.method,
    args: raw?.args,
    url: toUrl(raw?.url),
  }
}

async function main() {
  const report = {
    port,
    ok: false,
    url: `http://127.0.0.1:${port}/`,
    repo: {},
    server: null,
    pipeline: null,
    source: null,
    auth: null,
    evidence: {},
  }

  // 1. Server liveness.
  let statusPayload
  try {
    const response = await fetch(`http://127.0.0.1:${port}/__debug/status`, {
      signal: AbortSignal.timeout(3000),
    })
    statusPayload = response.ok ? await response.json() : { httpStatus: response.status }
  } catch (error) {
    problems.push(
      `no debug server on port ${port}: ${error.cause?.code ?? error.name}. Start it: cd apps/website && vp dev --host --port ${port}`,
    )
    return report
  }
  const status = parseStatus(statusPayload)
  if (status === null) {
    problems.push(
      `/__debug/status did not return sessionStartedAt (got ${JSON.stringify(statusPayload)}); this port is probably not a Vois DevServer`,
    )
    return report
  }
  report.server = {
    sessionStartedAt: new Date(status.sessionStartedAt).toISOString(),
    sessionAgeSeconds: Math.round((Date.now() - status.sessionStartedAt) / 1000),
    events: status.count,
    sizeBytes: status.sizeBytes,
  }

  // 2. Repo identity.
  report.repo = {
    path: repoRoot,
    revision: sh('git', ['rev-parse', '--short', 'HEAD']),
    branch: sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    dirtyFiles: (sh('git', ['status', '--porcelain']) ?? '').split('\n').filter(Boolean).length,
    worktreeIsMain:
      sh('git', ['rev-parse', '--path-format=absolute', '--git-dir'])?.endsWith('/.git') ?? null,
  }

  // 3. Pipeline: did a page connect in this session, and what did the pages do?
  const events = readEvents()
  const current = events.filter(
    (event) => event.receivedAt !== null && event.receivedAt >= status.sessionStartedAt,
  )
  const connected = current.some(
    (event) =>
      event.type === 'console' &&
      JSON.stringify(event.args ?? '').includes('WebView debug connected'),
  )
  const network = current.filter((event) => event.type === 'network' && event.url !== null)
  const v2 = network.filter((event) => event.url.pathname.startsWith('/v2/'))
  const failed = v2.filter((event) => Number(event.status) >= 400)
  const errors = current.filter((event) => event.type === 'error')
  report.pipeline = {
    eventsThisSession: current.length,
    pageConnected: connected,
    v2Calls: v2.length,
    v2Failed: failed.map((event) => `${event.method} ${event.url.pathname} -> ${event.status}`),
    pageErrors: errors.length,
    lastV2:
      v2.length > 0
        ? `${v2.at(-1).method} ${scrub(v2.at(-1).url.pathname)} -> ${v2.at(-1).status}`
        : null,
  }
  if (!connected)
    problems.push(
      `no page connected in this server session. Open http://localhost:${port}/#/ and reload with ?debug-reload=1 if the 🟢 marker is missing`,
    )
  if (v2.length === 0)
    warnings.push('no /v2 call captured yet in this session; auth is unproven until one page loads')
  if (failed.length > 0)
    warnings.push(
      `${failed.length} /v2 call(s) returned >= 400 (see pipeline.v2Failed). A 404 here is usually a removed endpoint, a 401/31 an expired session`,
    )

  // 4. Auth: the token endpoint minted one for this session?
  const mints = network.filter((event) => event.url.pathname === '/__vois-bridge/access-token')
  report.auth = {
    tokenMints: mints.length,
    lastMintStatus: mints.length > 0 ? mints.at(-1).status : null,
    note: 'GET /__vois-bridge/access-token is the debug account fallback; a 200 mint plus a 200 /v2 call means the session is signed in',
  }
  if (mints.length > 0 && mints.at(-1).status !== 200)
    warnings.push(
      `the token mint answered ${mints.at(-1).status}; pages will fall back to whatever session storage holds`,
    )

  // 5. Staleness: source, config, or the shared env newer than the server session.
  const watch = [
    'apps/website/src',
    'apps/website/vite.config.ts',
    'apps/website/uno.config.ts',
    'apps/website/plugins',
    'packages/mcp/src',
  ]
  const newer = []
  // Generated, not authored: vue-router rewrites route-map.d.ts on every serve, so it
  // is always newer than the session and would mask a real stale edit.
  const GENERATED = /route-map\.d\.ts$/
  const walk = (path) => {
    let stat
    try {
      stat = statSync(path)
    } catch {
      return
    }
    if (stat.isDirectory()) {
      if (path.includes('node_modules') || path.endsWith('/.tmp') || path.endsWith('/dist')) return
      for (const entry of readdirSync(path)) walk(join(path, entry))
      return
    }
    if (GENERATED.test(path)) return
    if (stat.mtimeMs > status.sessionStartedAt) newer.push(`${path.slice(repoRoot.length + 1)}`)
  }
  for (const relative of watch) walk(join(repoRoot, relative))
  const envPath = join(process.env.HOME ?? '', '.vois/.env')
  const envNewer = existsSync(envPath) && statSync(envPath).mtimeMs > status.sessionStartedAt
  report.source = {
    filesNewerThanServerSession: newer.slice(0, 20),
    moreNewerFiles: Math.max(0, newer.length - 20),
    envNewerThanServerSession: envNewer,
    note: 'src edits are hot-reloaded; vite.config.ts, plugins/, dependency upgrades, and ~/.vois/.env are not. Restart with --force when those moved',
  }
  if (newer.length > 0)
    warnings.push(
      `${newer.length} source file(s) newer than the server session; HMR usually covers src/, but restart before trusting config or env changes`,
    )

  // 6. Evidence: what proof already exists.
  const evidenceDir = join(repoRoot, 'apps/website/.tmp/verify')
  report.evidence = { dir: evidenceDir, exists: existsSync(evidenceDir) }

  report.ok = problems.length === 0
  return report
}

const report = await main()
report.problems = problems
report.warnings = warnings

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} else {
  const line = (label, value) => process.stdout.write(`${label.padEnd(14)}${value}\n`)
  line('verdict', report.ok ? '✅ worth driving' : '❌ do not drive')
  line('url', report.url)
  if (report.server) {
    line(
      'session',
      `${report.server.sessionStartedAt} (${report.server.sessionAgeSeconds}s old, ${report.server.events} events)`,
    )
  }
  if (report.repo.revision)
    line('repo', `${report.repo.branch}@${report.repo.revision} (${report.repo.dirtyFiles} dirty)`)
  if (report.pipeline) {
    line(
      'pipeline',
      `connected=${report.pipeline.pageConnected} v2=${report.pipeline.v2Calls} failed=${report.pipeline.v2Failed.length} errors=${report.pipeline.pageErrors}`,
    )
  }
  if (report.auth)
    line('auth', `mints=${report.auth.tokenMints} last=${report.auth.lastMintStatus}`)
  if (report.source)
    line(
      'staleness',
      `${report.source.filesNewerThanServerSession.length} newer file(s)${report.source.envNewerThanServerSession ? ', env newer' : ''}`,
    )
  if (report.pipeline?.v2Failed.length) line('v2 failures', report.pipeline.v2Failed.join(', '))
  for (const problem of problems) line('problem', problem)
  for (const warning of warnings) line('warning', warning)
}

process.exitCode = report.ok ? 0 : 1
