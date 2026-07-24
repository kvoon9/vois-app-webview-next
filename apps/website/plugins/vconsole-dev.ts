import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { Plugin, PreviewServer } from 'vite-plus'

export function vconsoleDev(): Plugin {
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
    },
  }
}
