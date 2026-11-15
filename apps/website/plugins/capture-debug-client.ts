import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite-plus'

/** Paths the debug plugin owns; its package exports no constants module. */
const CLIENT_PATH = '/__debug/client.js'

/**
 * Serves a Chrome 70-parsable client at the debug plugin's own client path.
 * The plugin's full client uses optional chaining, which the L2 engine cannot
 * parse. Pages without `?capture=bridge` still get that client, embedded and
 * run synchronously, so the default capture is unchanged. Registered before
 * the debug plugin so this route wins; every other path falls through to it.
 */
export function captureDebugClient(options: { preview: boolean }): Plugin {
  const require = createRequire(import.meta.url)
  const clientTemplate = readFileSync(new URL('./debug-client-bridge.js', import.meta.url), 'utf8')
  const fullClientSource = readFileSync(
    require.resolve('vite-plugin-vois-webview-debug/client'),
    'utf8',
  )
  // U+2028/U+2029 are line terminators only for old JS parsers; escape them so
  // the embedded source stays one string literal on Chrome 70.
  const embedded = JSON.stringify(fullClientSource)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
  const clientScript = `var voisFullDebugClientSource = ${embedded}\n${clientTemplate}`
  let enabled = false

  const middleware: Connect.NextHandleFunction = (request, response, next) => {
    if (request.method !== 'GET') return next()
    const pathname = new URL(request.url || '/', 'http://localhost').pathname
    if (pathname !== CLIENT_PATH) return next()
    response.setHeader('Content-Type', 'text/javascript; charset=utf-8')
    response.end(clientScript)
  }

  return {
    name: 'vois-capture-debug-client',
    // The debug plugin is `pre`, so matching that level keeps this route ahead
    // of it in the middleware stack; array order settles the tie.
    enforce: 'pre',
    config(_config, environment) {
      enabled =
        environment.command === 'serve' && (!environment.isPreview || options.preview === true)
    },
    configureServer(server: ViteDevServer) {
      if (enabled) server.middlewares.use(middleware)
    },
    configurePreviewServer(server: PreviewServer) {
      if (enabled) server.middlewares.use(middleware)
    },
  }
}
