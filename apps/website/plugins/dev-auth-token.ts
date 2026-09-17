import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Plugin } from 'vite-plus'

/**
 * Canonical token file, shared by every worktree. The WebView debug plugin rewrites
 * it, and this plugin reads it back per request.
 */
export const accessTokenFile = join(homedir(), '.vois', 'webview-access-token.env')

const ACCESS_TOKEN_LINE = /^VITE_ACCESS_TOKEN=([^#\n]+)/m

/**
 * Read `VITE_ACCESS_TOKEN` from dotenv text; missing, empty, or blank means no token.
 *
 * The debug plugin extracts the token from a reported URL with plain string
 * splitting, so a hash-routed launch (`?access-token=…&#/route`) stores a trailing
 * `#/route`. Stopping at `#` matches `loadEnv` and keeps the fragment out of the token.
 */
export function parseAccessToken(env: string): string | null {
  return ACCESS_TOKEN_LINE.exec(env)?.[1].trim() || null
}

function currentAccessToken(): string | null {
  try {
    // Read per request: the token lands in the file while the server keeps running.
    return parseAccessToken(readFileSync(accessTokenFile, 'utf8'))
  } catch {
    /* no file until the first WebView launch captures a token */
    return null
  }
}

function serveAccessToken(request: IncomingMessage, response: ServerResponse): void {
  if (request.method !== 'GET') {
    response.statusCode = 405
    response.end()
    return
  }

  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify({ token: currentAccessToken() }))
}

/**
 * Serve the worktree-shared access token on dev and preview servers, so the WebView
 * stops needing a per-worktree `.env.local` seed.
 */
export function devAuthToken(): Plugin {
  return {
    name: 'dev-auth-token',
    configureServer(server) {
      server.middlewares.use('/__auth/token', serveAccessToken)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/__auth/token', serveAccessToken)
    },
  }
}
