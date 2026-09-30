import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vite-plus/test'

import type { ResolvedConfig } from '../src/config.ts'
import type { FetchLike } from '../src/debug-server.ts'
import type { McpTool } from '../src/mcp.ts'
import { createDebugTools } from '../src/tools.ts'

/** A fetch that never answers; events runs never need one. */
const fetchDead: FetchLike = async () => {
  throw new Error('ECONNREFUSED')
}

/** Writes a raw JSONL capture and builds the events tool bound to it. */
function toolsOverLines(lines: string[]): McpTool {
  const eventsFile = join(mkdtempSync(join(tmpdir(), 'vois-mcp-')), 'events.jsonl')
  writeFileSync(eventsFile, `${lines.join('\n')}\n`)
  const config: ResolvedConfig = {
    ports: [1],
    eventsFile,
    apiBase: 'https://api.example.com',
    appId: 'app',
    appKey: 'key',
    fixedAccount: { account: 'a', password: 'p', countryCode: '86' },
  }
  const events = createDebugTools(config, fetchDead).find((tool) => tool.name === 'events')
  if (events === undefined) throw new Error('events tool missing')
  return events
}

const capture = [
  { type: 'network', method: 'GET', url: '/a', receivedAt: 1 },
  { type: 'network', method: 'GET', url: '/b', receivedAt: 2 },
  { type: 'network', method: 'GET', url: '/c', receivedAt: 3 },
].map((event) => JSON.stringify(event))

test('events clamps the limit from both sides', async () => {
  const events = toolsOverLines(capture)

  const negative = await events.run({ limit: -5 })
  expect(negative.isError).not.toBe(true)
  expect(negative.content[0]?.text).toContain('showing last 1 of 3 matching')
  expect(negative.content[0]?.text).toContain('/c')
  expect(negative.content[0]?.text).not.toContain('/a')

  const zero = await events.run({ limit: 0 })
  expect(zero.content[0]?.text).toContain('showing last 1 of 3 matching')

  const huge = await events.run({ limit: 9999 })
  expect(huge.content[0]?.text).toContain('showing last 3 of 3 matching')
})

test('events filters by type and reports malformed lines', async () => {
  const events = toolsOverLines([...capture, 'not json'])
  const result = await events.run({ type: 'network', limit: 2 })
  const text = result.content[0]?.text ?? ''
  expect(text).toContain('1 malformed lines skipped')
  expect(text).toContain('showing last 2 of 3 matching')
  expect(text).toContain('/c')
  expect(text).not.toContain('/a')
})
