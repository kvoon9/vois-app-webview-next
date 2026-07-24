import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import type { ServerResponse } from 'node:http'
import { defineConfig } from 'vite-plus'
import type { Connect, Plugin, PreviewServer } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import legacy from '@vitejs/plugin-legacy'
import VueRouter from 'vue-router/vite'
import vueDevtools from 'vite-plugin-vue-devtools'

function vconsoleDev(): Plugin {
  const require = createRequire(import.meta.url)
  const vconsolePath = require.resolve('vconsole/dist/vconsole.min.js')
  const vconsoleSource = `${readFileSync(vconsolePath, 'utf-8')}\nnew VConsole()`
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
        `<script src="${resolvedId}"></script>\n    <div id="app">`,
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
          if (url !== '/' && !url.endsWith('.html')) return next()
          const outDir = resolve(server.config.root, server.config.build.outDir)
          const pathname = url === '/' ? 'index.html' : url.replace(/^\/+/, '')
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
            `<script src="${resolvedId}"></script>\n    <div id="app">`,
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
