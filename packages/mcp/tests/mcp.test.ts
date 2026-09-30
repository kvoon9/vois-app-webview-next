import * as v from 'valibot'
import { expect, test } from 'vite-plus/test'

import type { JsonValue } from '../src/json.ts'
import { JsonValueSchema, decodeField } from '../src/json.ts'
import type { McpTool } from '../src/mcp.ts'
import { createMcpHandler, textResult } from '../src/mcp.ts'

/** A tool that answers, and a tool that always throws. */
const tools: McpTool[] = [
  {
    name: 'ok',
    description: 'Always answers',
    inputSchema: { type: 'object', properties: {} },
    run: async () => textResult('hi'),
  },
  {
    name: 'boom',
    description: 'Always throws',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      throw new Error('kaputt')
    },
  },
]

const handler = createMcpHandler({ serverInfo: { name: 'test', version: '1.2.3' }, tools })

/** Decoded shape of any response this suite cares about. */
interface DecodedResponse {
  id?: number | null
  result?: Record<string, JsonValue>
  error?: { code: number; message: string }
}

const ResponseSchema = v.object({
  jsonrpc: v.literal('2.0'),
  id: v.optional(v.nullable(v.number())),
  result: v.optional(v.record(v.string(), JsonValueSchema)),
  error: v.optional(v.object({ code: v.number(), message: v.string() })),
})

/** Builds one request object without `undefined` values. */
function rpcRequest(method: string, id?: number, params?: JsonValue): JsonValue {
  const base = { jsonrpc: '2.0', method }
  if (id === undefined) return base
  if (params === undefined) return { ...base, id }
  return { ...base, id, params }
}

/** Sends a request and decodes the response payload. */
async function exchange(method: string, id?: number, params?: JsonValue): Promise<DecodedResponse> {
  const raw = await handler(rpcRequest(method, id, params))
  const decoded = v.safeParse(ResponseSchema, raw)
  return decoded.success ? decoded.output : {}
}

test('initialize echoes the requested protocol version and describes the server', async () => {
  const response = await exchange('initialize', 1, { protocolVersion: '2025-03-26' })
  expect(response.result).toMatchObject({
    protocolVersion: '2025-03-26',
    serverInfo: { name: 'test', version: '1.2.3' },
    capabilities: { tools: {} },
  })
})

test('initialize falls back to the latest version when none is requested', async () => {
  const response = await exchange('initialize', 1, {})
  expect(response.result).toMatchObject({ protocolVersion: '2025-06-18' })
})

test('tools/list describes every tool', async () => {
  const response = await exchange('tools/list', 3)
  const toolList =
    decodeField(v.array(v.object({ name: v.string() })), response.result?.tools) ?? []
  expect(toolList.map((tool) => tool.name)).toEqual(['ok', 'boom'])
})

test('tools/call returns the tool result', async () => {
  const response = await exchange('tools/call', 4, { name: 'ok', arguments: {} })
  expect(response.result).toEqual({ content: [{ type: 'text', text: 'hi' }] })
})

test('ping answers an empty result', async () => {
  await expect(exchange('ping', 2)).resolves.toMatchObject({ result: {} })
})

test('tools/call reports thrown tool failures as isError results', async () => {
  const response = await exchange('tools/call', 5, { name: 'boom' })
  const content =
    decodeField(
      v.array(v.object({ type: v.string(), text: v.string() })),
      response.result?.content,
    ) ?? []
  expect(response.result?.isError).toBe(true)
  expect(content[0]?.text).toContain('kaputt')
})

test('tools/call rejects unknown tools and malformed arguments', async () => {
  const unknown = await exchange('tools/call', 6, { name: 'nope' })
  expect(unknown.result?.isError).toBe(true)
  const malformed = await exchange('tools/call', 7, { name: 'ok', arguments: 'nope' })
  expect(malformed.result?.isError).toBe(true)
})

test('notifications are left unanswered and unknown methods get -32601', async () => {
  await expect(handler(rpcRequest('notifications/initialized'))).resolves.toBeNull()
  const response = await exchange('no/such', 8)
  expect(response.error?.code).toBe(-32601)
})

test('messages that are not JSON-RPC requests get -32600', async () => {
  const raw = await handler({ hello: 1 })
  const decoded = v.safeParse(ResponseSchema, raw)
  expect(decoded.success && decoded.output.error?.code).toBe(-32600)
})
