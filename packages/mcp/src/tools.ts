import { readFileSync } from 'node:fs'
import * as v from 'valibot'
import type { JsonObject, JsonValue } from './json.ts'
import { asJsonObject, decodeField, readNumber, readString, readValue } from './json.ts'
import type { ResolvedConfig } from './config.ts'
import type { DebugServerStatus, FetchLike } from './debug-server.ts'
import { loginDebugAccount, probeDebugServer, readDebugSession } from './debug-server.ts'
import {
  countByType,
  DEBUG_EVENT_TYPES,
  formatDebugEvent,
  readEventsFile,
  selectEvents,
  truncateText,
} from './events.ts'
import { redactJson, redactText } from './redact.ts'
import { callVoisApi } from './api.ts'
import type { McpTool } from './mcp.ts'
import { textResult } from './mcp.ts'

/** How to start the debug server, included wherever a server is missing. */
const START_HINT = [
  'No debug server answered. Start one in a Herdr pane with:',
  '  cd apps/website && vp dev --host --port 3021',
  'or for the production artifact:',
  '  vp run preview:production',
].join('\n')

/** Reads an optional object argument. */
function readObjectArg(args: Record<string, JsonValue>, key: string): JsonObject | undefined {
  return asJsonObject(readValue(args, key))
}

/** Formats a byte count for the status lines. */
function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  return `${(sizeBytes / 1024).toFixed(1)} KB`
}

/** Formats how long the debug session has been up. */
function formatUptime(startedAt: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - startedAt) / 60_000))
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${minutes % 60}m`
}

/**
 * Probes the configured ports and returns the first live server, keeping the
 * configured order so a stable setup always answers from the same port.
 */
async function firstAliveStatus(
  config: ResolvedConfig,
  fetchImpl: FetchLike,
): Promise<DebugServerStatus | null> {
  const statuses = await Promise.all(config.ports.map((port) => probeDebugServer(port, fetchImpl)))
  return statuses.find((status) => status !== null) ?? null
}

/** Builds the five debug tools, all bound to one resolved configuration. */
export function createDebugTools(config: ResolvedConfig, fetchImpl: FetchLike = fetch): McpTool[] {
  return [
    statusTool(config, fetchImpl),
    eventsTool(config),
    loginTool(config, fetchImpl),
    tokenTool(config, fetchImpl),
    apiTool(config, fetchImpl),
  ]
}

/** `status`: which debug servers are alive and how much they captured. */
function statusTool(config: ResolvedConfig, fetchImpl: FetchLike): McpTool {
  return {
    name: 'status',
    description:
      'Probe local WebView debug servers and report the alive ones with captured event counts. Call this first.',
    inputSchema: {
      type: 'object',
      properties: {
        ports: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Ports to probe; defaults to the configured list',
        },
      },
    },
    run: async (args) => {
      const ports = readNumberListArg(args, 'ports')
      const candidates = ports && ports.length > 0 ? ports : config.ports
      const statuses = await Promise.all(
        candidates.map((port) => probeDebugServer(port, fetchImpl)),
      )
      const alive = statuses.filter((status): status is DebugServerStatus => status !== null)
      if (alive.length === 0)
        return textResult(`${START_HINT}\nProbed ports: ${candidates.join(', ')}`)

      const lines = alive.map((status) =>
        [
          `port ${status.port}`,
          `${status.count} events (${formatBytes(status.sizeBytes)})`,
          `session started ${new Date(status.sessionStartedAt).toLocaleTimeString('en-GB')}`,
          `up ${formatUptime(status.sessionStartedAt, status.now)}`,
        ].join(', '),
      )
      return textResult(
        [`events file: ${config.eventsFile || '(unknown, pass --events-file)'}`, ...lines].join(
          '\n',
        ),
      )
    },
  }
}

/** Reads an optional integer-list argument. */
function readNumberListArg(args: Record<string, JsonValue>, key: string): number[] | undefined {
  return decodeField(
    v.pipe(v.array(v.pipe(v.number(), v.integer())), v.minLength(1)),
    readValue(args, key),
  )
}

/** `events`: read what the pages did, filtered, credentials withheld. */
function eventsTool(config: ResolvedConfig): McpTool {
  return {
    name: 'events',
    description:
      'Read captured page events (lifecycle, network, console, bridge, error) from the debug server. Filter by type or text; output is newest-last and redacted of tokens.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [...DEBUG_EVENT_TYPES],
          description: 'Only events of this type',
        },
        query: {
          type: 'string',
          description: 'Case-insensitive substring matched against each event',
        },
        limit: {
          type: 'integer',
          description: 'How many of the last matching events to show (default 50, max 200)',
        },
      },
    },
    run: async (args) => {
      if (config.eventsFile === '') {
        return textResult(
          'No events file configured. Pass --events-file or run inside the repository.',
          true,
        )
      }
      let content: string
      try {
        content = readFileSync(config.eventsFile, 'utf8')
      } catch {
        return textResult(`events file not found: ${config.eventsFile}\n${START_HINT}`, true)
      }

      const { events, skipped } = readEventsFile(content)
      const summary = [...countByType(events).entries()]
        .map(([type, count]) => `${type} ${count}`)
        .join(', ')
      const limit = Math.max(1, Math.trunc(Math.min(readNumber(args, 'limit') ?? 50, 200)))
      const { matched, selected } = selectEvents(events, {
        type: readString(args, 'type'),
        query: readString(args, 'query'),
        limit,
      })

      const header = [
        `${config.eventsFile}: ${events.length} events (${summary || 'empty'})`,
        skipped > 0 ? `${skipped} malformed lines skipped` : undefined,
        `showing last ${selected.length} of ${matched.length} matching`,
      ].filter((line) => line !== undefined)
      return textResult([...header, ...selected.map(formatDebugEvent)].join('\n'))
    },
  }
}

/** `login`: switch or refresh the account the debug session signs in as. */
function loginTool(config: ResolvedConfig, fetchImpl: FetchLike): McpTool {
  return {
    name: 'login',
    description:
      'Sign the debug session in as an account. With no arguments it re-signs the fixed debug account; with account and password it switches to that account. Pages pick up the new login-id and token on their next read. The token itself is never returned.',
    inputSchema: {
      type: 'object',
      properties: {
        account: {
          type: 'string',
          description: 'Phone number or account name; omit to use the fixed debug account',
        },
        password: {
          type: 'string',
          description: 'Account password; required together with account',
        },
        countryCode: { type: 'string', description: 'Phone country code, default 86' },
      },
    },
    run: async (args) => {
      const account = readString(args, 'account')
      const password = readString(args, 'password')
      const countryCode = readString(args, 'countryCode') ?? '86'
      if ((account === undefined) !== (password === undefined)) {
        return textResult(
          'Pass account and password together, or neither to re-sign the fixed debug account.',
          true,
        )
      }

      const status = await firstAliveStatus(config, fetchImpl)
      if (status === null) return textResult(START_HINT, true)

      const credentials =
        account !== undefined && password !== undefined
          ? { account, password, countryCode }
          : config.fixedAccount
      const session = await loginDebugAccount(status.port, credentials, fetchImpl)
      const who =
        session.userId === undefined
          ? 'the account'
          : `userId ${session.userId} (login-id ${session.userId})`
      return textResult(
        `Signed in on port ${status.port} as ${who}. The token endpoint now serves this session.`,
      )
    },
  }
}

/** `token`: verify the mint pipeline without exposing the token itself. */
function tokenTool(config: ResolvedConfig, fetchImpl: FetchLike): McpTool {
  return {
    name: 'token',
    description:
      'Read the debug session through the server token endpoint and report who it belongs to. The token stays hidden; only its length and fingerprint are shown.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const status = await firstAliveStatus(config, fetchImpl)
      if (status === null) return textResult(START_HINT, true)
      const session = await readDebugSession(status.port, fetchImpl)
      const fingerprint = (await digestFingerprint(session.token)).slice(0, 8)
      const who = session.userId === undefined ? 'unknown user' : `userId ${session.userId}`
      return textResult(
        `port ${status.port}: token endpoint OK, ${who}, token length ${session.token.length}, sha256 ${fingerprint}`,
      )
    },
  }
}

/** Hashes the token so it can be compared across calls without showing it. */
async function digestFingerprint(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** `api`: call the /v2 HTTP API as the signed-in debug account. */
function apiTool(config: ResolvedConfig, fetchImpl: FetchLike): McpTool {
  return {
    name: 'api',
    description:
      "Call a /v2 HTTP API with the app's signing and the debug session token, as the WebView itself would. The envelope (errcode/errmsg/data) comes back with token fields redacted; the token itself never appears.",
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'API path starting with /v1 or /v2' },
        method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method, default POST' },
        body: { type: 'object', description: 'JSON request body (POST only)' },
        query: {
          type: 'object',
          additionalProperties: { anyOf: [{ type: 'string' }, { type: 'number' }] },
          description:
            'Extra query parameters; appid, et, sign, and token are reserved and ignored',
        },
      },
      required: ['path'],
    },
    run: async (args) => {
      const path = readString(args, 'path')
      if (path === undefined || path === '')
        return textResult('path is required, for example /v2/subuser/list', true)
      const method = readString(args, 'method') === 'GET' ? 'GET' : 'POST'
      const body = readObjectArg(args, 'body')
      const status = await firstAliveStatus(config, fetchImpl)
      if (status === null) return textResult(START_HINT, true)

      const session = await readDebugSession(status.port, fetchImpl)
      const query = readQueryArg(args)
      const result = await callVoisApi({
        apiBase: config.apiBase,
        path,
        method,
        body: body ?? undefined,
        query,
        appId: config.appId,
        appKey: config.appKey,
        token: session.token,
        fetchImpl,
      })
      const header = `${method} ${config.apiBase}${path.startsWith('/') ? path : `/${path}`} -> HTTP ${result.httpStatus}`
      const payload = result.isJson
        ? JSON.stringify(redactJson(result.body), null, 2)
        : redactText(result.body)
      return textResult(`${header}\n${truncateText(payload, API_OUTPUT_LIMIT)}`)
    },
  }
}

/** How much rendered API output one tool result may carry. */
const API_OUTPUT_LIMIT = 12_000

/** Reads the optional query-parameter record. */
function readQueryArg(
  args: Record<string, JsonValue>,
): Record<string, string | number> | undefined {
  return decodeField(
    v.record(v.string(), v.union([v.string(), v.number()])),
    readObjectArg(args, 'query'),
  )
}
