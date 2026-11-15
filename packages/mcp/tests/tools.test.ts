import * as v from 'valibot'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vite-plus/test'

import type { DebugCredentials, ResolvedConfig } from '../src/config.ts'
import type { FetchLike } from '../src/debug-server.ts'
import type { JsonValue } from '../src/json.ts'
import { parseJson } from '../src/json.ts'
import type { McpTool } from '../src/mcp.ts'
import { countryCodeForAccount, createDebugTools } from '../src/tools.ts'

/** A fetch that never answers; events runs never need one. */
const fetchDead: FetchLike = async () => {
  throw new Error('ECONNREFUSED')
}

const FIXED_ACCOUNT: DebugCredentials = {
  account: '13800000000',
  password: 'p',
  countryCode: '86',
}

/** A resolved config for tool tests; only the fixed account varies per suite. */
function testConfig(fixedAccount: DebugCredentials = FIXED_ACCOUNT): ResolvedConfig {
  return {
    ports: [1],
    eventsFile: '',
    apiBase: 'https://api.example.com',
    appId: 'app',
    appKey: 'key',
    fixedAccount,
  }
}

/** Picks the named tool out of a tool set, so tests do not repeat the lookup. */
function findTool(tools: McpTool[], name: string): McpTool {
  const found = tools.find((candidate) => candidate.name === name)
  if (found === undefined) throw new Error(`${name} tool missing`)
  return found
}

/** Writes a raw JSONL capture and builds every tool bound to it. */
function allToolsOverLines(lines: string[]): McpTool[] {
  const eventsFile = join(mkdtempSync(join(tmpdir(), 'vois-mcp-')), 'events.jsonl')
  writeFileSync(eventsFile, `${lines.join('\n')}\n`)
  return createDebugTools({ ...testConfig(), eventsFile }, fetchDead)
}

/** Writes a raw JSONL capture and builds the events tool bound to it. */
function toolsOverLines(lines: string[]): McpTool {
  return findTool(allToolsOverLines(lines), 'events')
}

const capture = [
  { type: 'network', method: 'GET', url: '/a', receivedAt: 1 },
  { type: 'network', method: 'GET', url: '/b', receivedAt: 2 },
  { type: 'network', method: 'GET', url: '/c', receivedAt: 3 },
].map((event) => JSON.stringify(event))

/** One request a fake debug server saw. */
interface ServerRequest {
  url: string
  body?: string
}

/** What a fake debug server exposes to a test. */
interface FakeServer {
  requests: ServerRequest[]
  fetchImpl: FetchLike
}

/** A fake debug server: answers the status probe and the login, recording both. */
function fakeServer(): FakeServer {
  const requests: ServerRequest[] = []
  const fetchImpl: FetchLike = async (url, init) => {
    const body = init?.body === undefined ? undefined : v.parse(v.string(), init.body)
    requests.push(body === undefined ? { url } : { url, body })
    const payload = url.endsWith('/__debug/status')
      ? { count: 0, sizeBytes: 0, sessionStartedAt: 1, now: 2 }
      : { token: 'tok', userId: 7 }
    return new Response(JSON.stringify(payload), { status: 200 })
  }
  return { requests, fetchImpl }
}

/** Reads the credentials the login tool posted to a fake server. */
function postedCredentials(requests: ServerRequest[]): JsonValue | undefined {
  const login = requests.findLast((request) => request.url.endsWith('/__vois-bridge/login'))
  return parseJson(login?.body ?? '')
}

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

test('events prints the bridge summary and timeline', async () => {
  const events = toolsOverLines([
    JSON.stringify({
      type: 'bridge',
      direction: 'send',
      protocol: 'get-page-params',
      data: {},
      receivedAt: 1,
    }),
    JSON.stringify({
      type: 'bridge',
      direction: 'receive',
      protocol: 'get-page-params',
      data: { errcode: 0, data: {} },
      receivedAt: 2,
    }),
    JSON.stringify({ type: 'lifecycle', event: 'load', url: '/', receivedAt: 3 }),
  ])
  const text = (await events.run({})).content[0]?.text ?? ''
  expect(text).toContain('bridge summary: 2 events')
  expect(text).toContain('get-page-params receive x1 errcodes 0x1')
  expect(text).toContain('bridge timeline:')
  expect(text).toContain('receive get-page-params errcode 0')
})

test('agreement matches a rendered value against the bridge capture', async () => {
  const tools = allToolsOverLines([
    JSON.stringify({
      type: 'bridge',
      direction: 'receive',
      protocol: 'device-get-detail',
      data: { errcode: 0, data: { name: 'wl301010386256' } },
      receivedAt: 2,
    }),
  ])
  const agreement = findTool(tools, 'agreement')

  const agreed = await agreement.run({ text: 'wl301010386256' })
  expect(agreed.isError).not.toBe(true)
  expect(agreed.content[0]?.text).toContain(
    'agreed: "wl301010386256" appears in bridge receive device-get-detail',
  )

  const missing = await agreement.run({ text: 'not-on-screen' })
  expect(missing.content[0]?.text).toContain('not agreed')

  const empty = await agreement.run({})
  expect(empty.isError).toBe(true)
})

test('countryCodeForAccount separates mobile numbers from 微喇号 accounts', () => {
  expect(countryCodeForAccount('13800000000')).toBe('86')
  expect(countryCodeForAccount('19912345678')).toBe('86')
  expect(countryCodeForAccount('wela12345')).toBe('0')
  expect(countryCodeForAccount('12800000000')).toBe('0')
  expect(countryCodeForAccount('')).toBeUndefined()
})

test('login derives the country code from the account it signs in as', async () => {
  for (const [account, countryCode] of [
    ['13800000000', '86'],
    ['wela12345', '0'],
  ]) {
    const server = fakeServer()
    const login = findTool(createDebugTools(testConfig(), server.fetchImpl), 'login')
    await login.run({ account, password: 'p' })
    expect(postedCredentials(server.requests)).toMatchObject({ account, countryCode })
  }
})

test('login derives the fixed account country code and keeps an explicit one', async () => {
  const fixed = { account: 'wela12345', password: 'p', countryCode: '86' }
  const server = fakeServer()
  const login = findTool(createDebugTools(testConfig(fixed), server.fetchImpl), 'login')

  await login.run({})
  expect(postedCredentials(server.requests)).toEqual({
    account: 'wela12345',
    password: 'p',
    countryCode: '0',
  })

  await login.run({ account: 'wela12345', password: 'p', countryCode: '852' })
  expect(postedCredentials(server.requests)).toMatchObject({ countryCode: '852' })
})

test('api names a real /v2 endpoint when the path is missing', async () => {
  const api = findTool(createDebugTools(testConfig(), fetchDead), 'api')
  const result = await api.run({})
  expect(result.isError).toBe(true)
  expect(result.content[0]?.text).toContain('/v2/subuser/manager-get-all-device')
})
