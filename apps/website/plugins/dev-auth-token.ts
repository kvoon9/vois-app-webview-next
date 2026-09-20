import { readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Plugin } from 'vite-plus'
import { maxLength, minLength, object, parseJson, pipe, safeParse, string } from 'valibot'
import { ACCESS_TOKEN_PATH, SAVE_ACCESS_TOKEN_PATH } from '../src/utils/auth-token-path'

/**
 * Canonical token file, shared by every worktree. The WebView debug plugin rewrites
 * it, and this plugin reads it back per request.
 */
export const accessTokenFile = join(homedir(), '.vois', 'webview-access-token.env')

const ACCESS_TOKEN_LINE = /^VITE_ACCESS_TOKEN=([^#\n]+)/m

/** The save endpoint accepts exactly this shape, decoded before it reaches the file. */
const saveTokenSchema = pipe(
  string(),
  parseJson(),
  object({ token: pipe(string(), minLength(1), maxLength(2048)) }),
)

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

/**
 * Write a token the page got over the bridge into the shared env file, so every
 * other worktree and the next server start can read it.
 *
 * The debug plugin only persists tokens it sees in a page URL. A token that
 * arrives over the bridge never appears in a URL, so without this the env file
 * keeps a stale token while the running page uses a fresh one.
 */
export function writeTokenToEnv(file: string, token: string): void {
  let env = ''
  try {
    env = readFileSync(file, 'utf8')
  } catch {
    /* first run: the file does not exist yet */
  }

  // A dotenv file is newline-terminated, and an empty file must not gain a
  // leading blank line, so only join when there is something to keep.
  const appended = env.trimEnd()
  const updated = env.includes('VITE_ACCESS_TOKEN=')
    ? env.replace(/^VITE_ACCESS_TOKEN=.*$/m, `VITE_ACCESS_TOKEN=${token}`)
    : `${appended ? `${appended}\n` : ''}VITE_ACCESS_TOKEN=${token}\n`
  // An identical rewrite still trips Vite's file watcher, which restarts the
  // server and reloads the page on every request.
  if (updated === env) return
  writeFileSync(file, updated, { mode: 0o600 })
}

async function handleSaveAccessToken(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== 'POST') {
    response.statusCode = 405
    response.end()
    return
  }

  const parsed = safeParse(saveTokenSchema, await readBody(request))
  if (!parsed.success) {
    response.statusCode = 400
    response.end()
    return
  }

  writeTokenToEnv(accessTokenFile, parsed.output.token)
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ saved: true }))
}

/** The raw request body; valibot decodes it so this never sees a parsed shape. */
function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
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
      server.middlewares.use(ACCESS_TOKEN_PATH, serveAccessToken)
      server.middlewares.use(
        SAVE_ACCESS_TOKEN_PATH,
        (request, response) => void handleSaveAccessToken(request, response),
      )
    },
    configurePreviewServer(server) {
      server.middlewares.use(ACCESS_TOKEN_PATH, serveAccessToken)
      server.middlewares.use(
        SAVE_ACCESS_TOKEN_PATH,
        (request, response) => void handleSaveAccessToken(request, response),
      )
    },
  }
}
