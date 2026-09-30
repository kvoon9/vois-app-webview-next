#!/usr/bin/env node
import { createInterface } from 'node:readline'
import packageJson from '../package.json' with { type: 'json' }
import type { JsonValue } from './json.ts'
import { parseJson } from './json.ts'
import { resolveConfig } from './config.ts'
import { parseArgv } from './argv.ts'
import { createDebugTools } from './tools.ts'
import { createMcpHandler } from './mcp.ts'

const HELP = `vois-webview-mcp: MCP stdio server for the Vois WebView debug pipeline.

Usage: vois-webview-mcp [--port <n>]... [--events-file <path>]

Options:
  --port <n>          Debug server port to probe; repeatable. Falls back to
                      $VOIS_DEBUG_PORTS, then 3021, 5173, 8080.
  --events-file <p>   JSONL capture to read. Falls back to $VOIS_DEBUG_EVENTS_FILE,
                      then apps/website/.tmp/vois-webview-debug/events.jsonl.

Environment: VOIS_API_BASE, VOIS_APP_ID, VOIS_APP_KEY, VOIS_DEBUG_ACCOUNT,
VOIS_DEBUG_PASSWORD, VOIS_DEBUG_COUNTRY_CODE override the defaults.
`

/** Runs the stdio loop: one JSON-RPC message per line in, one per line out. */
async function main(): Promise<void> {
  const { overrides, help, error } = parseArgv(process.argv.slice(2))
  if (error !== undefined) {
    console.error(`${error}\n\n${HELP}`)
    process.exitCode = 1
    return
  }
  if (help) {
    console.error(HELP)
    return
  }

  const config = resolveConfig(process.env, overrides)
  const handler = createMcpHandler({
    serverInfo: { name: 'vois-webview-debug', version: packageJson.version },
    tools: createDebugTools(config),
    instructions:
      'Debug pipeline for the Vois WebView app. Start a debug server first (cd apps/website && vp dev --host --port 3021), then: status finds it, events shows what pages did, login switches the debug account, api calls /v2 as the signed-in account. Tokens and passwords are redacted everywhere.',
  })

  const readline = createInterface({ input: process.stdin, terminal: false })
  const answer = (value: JsonValue | null): void => {
    if (value !== null) process.stdout.write(`${JSON.stringify(value)}\n`)
  }

  readline.on('line', (line) => {
    const raw = parseJson(line)
    if (raw === undefined) {
      if (line.trim() !== '')
        answer({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
      return
    }
    void handler(raw).then(answer)
  })
  readline.on('close', () => {
    process.exit(0)
  })

  console.error(
    `vois-webview-debug MCP ${packageJson.version}: probing ports ${config.ports.join(', ')}, events at ${config.eventsFile || '(unset)'}`,
  )
}

await main()
