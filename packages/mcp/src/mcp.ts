import * as v from 'valibot'
import type { JsonValue } from './json.ts'
import { JsonValueSchema, asJsonObject, decodeField, describeIssues } from './json.ts'

/** What one tool call reports back to the model. */
export type McpToolResult = {
  content: McpTextContent[]
  isError?: boolean
}

/** A single text block inside a tool result. */
export type McpTextContent = {
  type: 'text'
  text: string
}

/** A tool the server offers; `inputSchema` is plain JSON Schema. */
export interface McpTool {
  name: string
  description: string
  inputSchema: JsonValue
  run: (args: Record<string, JsonValue>) => Promise<McpToolResult>
}

/** Server identity reported during `initialize`. */
export interface McpServerInfo {
  name: string
  version: string
}

/** Protocol version this server speaks; clients send theirs and we echo it. */
const LATEST_PROTOCOL_VERSION = '2025-06-18'

const RpcRequestSchema = v.object({
  jsonrpc: v.literal('2.0'),
  id: v.optional(v.nullable(v.union([v.string(), v.number()]))),
  method: v.string(),
  params: v.optional(JsonValueSchema),
})

const ToolCallParamsSchema = v.object({
  name: v.string(),
  arguments: v.optional(v.record(v.string(), JsonValueSchema)),
})

/** Builds a successful JSON-RPC response payload. */
function rpcResult(id: string | number | null, result: JsonValue): JsonValue {
  return { jsonrpc: '2.0', id, result }
}

/** Builds a JSON-RPC error response payload. */
function rpcError(id: string | number | null, code: number, message: string): JsonValue {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

/** Wraps plain text as a tool result. */
export function textResult(text: string, isError = false): McpToolResult {
  const result: McpToolResult = { content: [{ type: 'text', text }] }
  if (isError) result.isError = true
  return result
}

/**
 * Creates the JSON-RPC handler for one server. Feed it each decoded stdin
 * message; a non-null return value is the response line to write back, and
 * `null` means the message was a notification and stays unanswered.
 */
export function createMcpHandler(options: {
  serverInfo: McpServerInfo
  tools: McpTool[]
  instructions?: string
}) {
  const toolsByName = new Map(options.tools.map((tool) => [tool.name, tool]))

  return async (raw: JsonValue): Promise<JsonValue | null> => {
    const decoded = v.safeParse(RpcRequestSchema, raw)
    if (!decoded.success)
      return rpcError(null, -32600, `Invalid Request: ${describeIssues(decoded.issues)}`)

    const request = decoded.output
    const { id, method } = request
    // JSON-RPC: no id means a notification, which never gets a response.
    if (id === undefined) return null

    if (method === 'initialize') {
      return rpcResult(id, buildInitializeResult(request.params, options))
    }
    if (method === 'ping') return rpcResult(id, {})
    if (method === 'tools/list') {
      return rpcResult(id, { tools: options.tools.map(toToolDescription) })
    }
    if (method === 'tools/call') {
      return rpcResult(id, await callTool(request.params, toolsByName))
    }
    return rpcError(id, -32601, `Method not found: ${method}`)
  }
}

/** Replies to `initialize`, echoing whatever protocol version the client sent. */
function buildInitializeResult(
  params: JsonValue | undefined,
  options: { serverInfo: McpServerInfo; instructions?: string },
): JsonValue {
  const requested = decodeField(
    v.pipe(v.string(), v.nonEmpty()),
    asJsonObject(params)?.protocolVersion,
  )
  const base = {
    protocolVersion: requested ?? LATEST_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: { name: options.serverInfo.name, version: options.serverInfo.version },
  }
  if (options.instructions === undefined) return base
  return { ...base, instructions: options.instructions }
}

/** The description object one tool contributes to `tools/list`. */
function toToolDescription(tool: McpTool): JsonValue {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }
}

/** Dispatches `tools/call`; a thrown tool becomes an `isError` text result. */
async function callTool(
  params: JsonValue | undefined,
  toolsByName: Map<string, McpTool>,
): Promise<JsonValue> {
  const decoded = v.safeParse(ToolCallParamsSchema, params ?? {})
  if (!decoded.success) {
    return textResult(`Invalid tool arguments: ${describeIssues(decoded.issues)}`, true)
  }
  const tool = toolsByName.get(decoded.output.name)
  if (tool === undefined) {
    return textResult(`Unknown tool: ${decoded.output.name}`, true)
  }
  try {
    return await tool.run(decoded.output.arguments ?? {})
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return textResult(`Tool ${decoded.output.name} failed: ${message}`, true)
  }
}
