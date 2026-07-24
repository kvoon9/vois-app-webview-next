import { appendFileSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import type { ServerResponse } from 'node:http'
import { defineConfig } from 'vite-plus'
import type { Connect, Plugin, PreviewServer } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import legacy from '@vitejs/plugin-legacy'
import VueRouter from 'vue-router/vite'
import vueDevtools from 'vite-plugin-vue-devtools'

const isDebug = process.argv.includes('--debug')
const debugAuthFile = resolve(tmpdir(), 'vois-app-webview-next-debug-auth.json')
const debugAuthTtl = 30 * 60 * 1000
const debugOutputDir = '/tmp/vois-webview-debug'
const debugEventsFile = resolve(debugOutputDir, 'events.jsonl')

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function readRequest(req: Connect.IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > limit) throw new Error('payload too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

function debugEventsMiddleware(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
): void {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname
  if (!isDebug || req.method !== 'POST' || !pathname.startsWith('/__debug/')) return next()

  mkdirSync(debugOutputDir, { recursive: true, mode: 0o700 })

  if (pathname === '/__debug/events') {
    void readRequest(req, 64 * 1024)
      .then((body) => {
        const event = JSON.parse(body.toString('utf-8')) as Record<string, unknown>
        appendFileSync(
          debugEventsFile,
          `${JSON.stringify({ ...event, receivedAt: Date.now() })}\n`,
          { mode: 0o600 },
        )
        sendJson(res, 202, { ok: true })
      })
      .catch(() => sendJson(res, 400, { error: 'Invalid debug event' }))
    return
  }

  next()
}

/** Relays one recent WebView URL from preview to the local dev server. */
function debugAuthRelay(): Plugin {
  return {
    name: 'debug-auth-relay',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(debugEventsMiddleware)
      server.middlewares.use((req, res, next) => {
        if (
          req.method !== 'GET' ||
          new URL(req.url || '/', 'http://localhost').pathname !== '/debug'
        )
          return next()

        try {
          const saved = JSON.parse(readFileSync(debugAuthFile, 'utf-8')) as {
            capturedAt: number
            url: string
          }
          unlinkSync(debugAuthFile)
          if (Date.now() - saved.capturedAt > debugAuthTtl) throw new Error('expired')

          res.statusCode = 302
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Location', saved.url)
          res.end()
        } catch {
          res.statusCode = 404
          res.setHeader('Cache-Control', 'no-store')
          res.end('No recent WebView debug auth found')
        }
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(debugEventsMiddleware)
      server.middlewares.use((req, _res, next) => {
        if (req.method === 'GET') {
          const url = new URL(req.url || '/', 'http://localhost')
          if (url.searchParams.get('access-token')) {
            writeFileSync(
              debugAuthFile,
              JSON.stringify({ capturedAt: Date.now(), url: `${url.pathname}${url.search}` }),
              { mode: 0o600 },
            )
          }
        }
        next()
      })
    },
  }
}

function vconsoleDev(): Plugin {
  const require = createRequire(import.meta.url)
  const vconsolePath = require.resolve('vconsole/dist/vconsole.min.js')
  const vconsoleSource = `${readFileSync(vconsolePath, 'utf-8')}\nnew VConsole()`
  const debugMeta = isDebug ? '<meta name="vois-webview-debug" content="enabled">\n    ' : ''
  const resolvedId = '/@vconsole-dev'

  return {
    name: 'vconsole-dev',
    apply: 'serve',
    resolveId(id) {
      if (id === resolvedId) return resolvedId
    },
    load(id) {
      if (id === resolvedId) return vconsoleSource
    },
    transformIndexHtml(html) {
      return html.replace(
        '<div id="app">',
        `${debugMeta}<script src="${resolvedId}"></script>\n    <div id="app">`,
      )
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(resolvedId, (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript')
        res.end(vconsoleSource)
      })
      // ponytail: manual HTML rewrite for preview only; Vite does not run transformIndexHtml here.
      const base = server.config.base || '/'
      server.middlewares.use(
        base.endsWith('/') ? base : `${base}/`,
        (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          if (req.method !== 'GET') return next()
          let url = (req.url || '').split('?')[0]
          if (!url.startsWith('/')) url = `/${url}`
          if (url !== '/' && url.split('/').at(-1)?.includes('.')) return next()
          const outDir = resolve(server.config.root, server.config.build.outDir)
          const pathname =
            url === '/' || !url.endsWith('.html') ? 'index.html' : url.replace(/^\/+/, '')
          const file = resolve(outDir, pathname)
          if (!file.startsWith(`${outDir}/`)) return next()
          let html: string
          try {
            html = readFileSync(file, 'utf-8')
          } catch {
            return next()
          }
          html = html.replace(
            '<div id="app">',
            `${debugMeta}<script src="${resolvedId}"></script>\n    <div id="app">`,
          )
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
        },
      )
    },
  }
}

export default defineConfig(({ isPreview }) => {
  return {
    server: {
      host: true,
      port: 3021,
      proxy: {
        '/v2': {
          target: 'https://api.voischat.cn',
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: 5173,
      proxy: {
        '/v2': {
          target: 'https://api.voischat.cn',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      ...(isPreview ? [vconsoleDev()] : []),
      ...(!isPreview || isDebug ? [debugAuthRelay()] : []),
      vueDevtools(),
      VueRouter({ dts: 'src/route-map.d.ts' }),
      vue(),
      unocss(),
      legacy({
        targets: ['chrome 83'],
        modernTargets: ['chrome 83'],
        modernPolyfills: true,
      }),
    ],
    resolve: {
      alias: {
        '~/': '/src/',
      },
    },
    build: {
      target: 'chrome83',
    },
  }
})
