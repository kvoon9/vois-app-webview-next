import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import type { ServerResponse } from 'node:http'
import type { Plugin } from 'vite-plus'
import type { Connect } from 'vite-plus'

const outputDir = resolve(import.meta.dirname, '../../.tmp/vois-webview-debug')
const eventsFile = resolve(outputDir, 'events.jsonl')
const envLocalFile = resolve(import.meta.dirname, '../../apps/website/.env.local')

export function debugAuthPlugin(): Plugin {
  const isDebug = process.argv.includes('--debug')
  const sessionStartedAt = Date.now()
  mkdirSync(outputDir, { recursive: true, mode: 0o700 })
  writeFileSync(eventsFile, '', { mode: 0o600 })

  const events = createEventsMiddleware(sessionStartedAt)

  return {
    name: 'debug-auth',
    enforce: 'pre',
    configureServer(server) {
      if (!isDebug) return
      server.middlewares.use(events)
      server.middlewares.use((req, _res, next) => {
        extractTokenFromRequest(req)
        next()
      })
    },
    configurePreviewServer(server) {
      if (!isDebug) return
      server.middlewares.use(events)
      server.middlewares.use((req, _res, next) => {
        extractTokenFromRequest(req)
        next()
      })
      server.middlewares.use(injectDebugMetaIntoPreviewHtml(server))
    },
  }
}

function replyJson(res: ServerResponse, code: number, body: unknown) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function bufferRequest(req: Connect.IncomingMessage, limit: number) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const b = Buffer.from(chunk)
    size += b.length
    if (size > limit) throw new Error('payload too large')
    chunks.push(b)
  }
  return Buffer.concat(chunks)
}

function countEventsInFile() {
  if (!existsSync(eventsFile)) return 0
  return readFileSync(eventsFile, 'utf-8').trim().split('\n').filter(Boolean).length
}

function appendEvent(event: Record<string, unknown>) {
  appendFileSync(eventsFile, `${JSON.stringify({ ...event, receivedAt: Date.now() })}\n`, {
    mode: 0o600,
  })
}

function handleStatusRequest(res: ServerResponse, sessionStartedAt: number) {
  const fileStat = existsSync(eventsFile) ? statSync(eventsFile) : null
  replyJson(res, 200, {
    count: countEventsInFile(),
    sizeBytes: fileStat?.size ?? 0,
    sessionStartedAt,
    now: Date.now(),
  })
}

function handleEventPost(req: Connect.IncomingMessage, res: ServerResponse) {
  bufferRequest(req, 256 * 1024)
    .then((body) => {
      appendEvent(JSON.parse(body.toString('utf-8')) as Record<string, unknown>)
      replyJson(res, 202, { ok: true })
    })
    .catch(() => replyJson(res, 400, { error: 'Invalid debug event' }))
}

function createEventsMiddleware(sessionStartedAt: number): Connect.NextHandleFunction {
  return (req, res, next) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname
    if (!pathname.startsWith('/__debug/')) return next()

    if (req.method === 'GET' && pathname === '/__debug/status') {
      return handleStatusRequest(res, sessionStartedAt)
    }
    if (req.method === 'POST' && pathname === '/__debug/events') {
      return handleEventPost(req, res)
    }
    next()
  }
}

function writeEnvToken(token: string) {
  const env = existsSync(envLocalFile) ? readFileSync(envLocalFile, 'utf-8') : ''
  const updated = env.includes('VITE_ACCESS_TOKEN=')
    ? env.replace(/^VITE_ACCESS_TOKEN=.*$/m, `VITE_ACCESS_TOKEN=${token}`)
    : `${env.trimEnd()}\nVITE_ACCESS_TOKEN=${token}\n`
  writeFileSync(envLocalFile, updated, { mode: 0o600 })
}

function extractTokenFromRequest(req: Connect.IncomingMessage) {
  if (req.method !== 'GET') return
  const token = new URL(req.url || '/', 'http://localhost').searchParams.get('access-token')
  if (token) writeEnvToken(token)
}

function injectDebugMetaIntoPreviewHtml(server: {
  config: { root: string; build: { outDir: string } }
}) {
  const outDir = resolve(server.config.root, server.config.build.outDir)
  const meta = '    <meta name="vois-webview-debug" content="enabled">\n'

  return (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    if (req.method !== 'GET') return next()
    const pathname = new URL(req.url || '/', 'http://localhost').pathname
    if (pathname.includes('.')) return next()
    if (pathname.startsWith('/__debug/')) return next()

    let html: string
    try {
      html = readFileSync(resolve(outDir, 'index.html'), 'utf-8')
    } catch {
      return next()
    }
    html = html.replace('    <div id="app">', `${meta}    <div id="app">`)
    res.setHeader('Content-Type', 'text/html')
    res.end(html)
  }
}
