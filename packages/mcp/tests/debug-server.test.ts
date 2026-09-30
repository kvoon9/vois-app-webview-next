import * as v from 'valibot'
import { expect, test } from 'vite-plus/test'

import type { FetchLike } from '../src/debug-server.ts'
import { loginDebugAccount, probeDebugServer, readDebugSession } from '../src/debug-server.ts'
import type { DebugCredentials } from '../src/config.ts'
import type { JsonValue } from '../src/json.ts'

/** A fetch that always answers with one JSON status. */
function fetchJson(status: number, body: JsonValue): FetchLike {
  return async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** A fetch that always fails like a dead port does. */
const fetchDead: FetchLike = async () => {
  throw new Error('ECONNREFUSED')
}

/** Records one request and answers with a canned response. */
interface RecordedRequest {
  url: string
  method?: string
  body?: string
}

/** What one canned server exposes to a test. */
interface RecordedExchange {
  requests: RecordedRequest[]
  fetchImpl: FetchLike
}

function recordingFetch(status: number, payload: JsonValue): RecordedExchange {
  const requests: RecordedRequest[] = []
  const fetchImpl: FetchLike = async (url, init) => {
    requests.push({ url, method: init?.method, body: v.parse(v.string(), init?.body) })
    return new Response(JSON.stringify(payload), { status })
  }
  return { requests, fetchImpl }
}

const credentials: DebugCredentials = { account: 'a', password: 'p', countryCode: '86' }

test('probeDebugServer reports the payload of a live port', async () => {
  const status = await probeDebugServer(
    3021,
    fetchJson(200, { count: 3, sizeBytes: 90, sessionStartedAt: 5, now: 9 }),
  )
  expect(status).toEqual({ port: 3021, count: 3, sizeBytes: 90, sessionStartedAt: 5, now: 9 })
})

test('probeDebugServer answers null for dead ports and wrong payloads', async () => {
  expect(await probeDebugServer(3021, fetchDead)).toBeNull()
  expect(await probeDebugServer(3021, fetchJson(404, {}))).toBeNull()
  expect(await probeDebugServer(3021, fetchJson(200, { hello: 'world' }))).toBeNull()
})

test('readDebugSession returns the served session', async () => {
  const session = await readDebugSession(5173, fetchJson(200, { token: 'abc', userId: 42 }))
  expect(session).toEqual({ token: 'abc', userId: 42 })
})

test('readDebugSession surfaces the server error verbatim', async () => {
  const failing = readDebugSession(5173, fetchJson(502, { error: '网关地址请求失败: HTTP 500' }))
  await expect(failing).rejects.toThrow('网关地址请求失败: HTTP 500')
})

test('loginDebugAccount posts credentials and reads the session', async () => {
  const { requests, fetchImpl } = recordingFetch(200, { token: 'tok', userId: 7 })
  const session = await loginDebugAccount(3021, credentials, fetchImpl)
  expect(session).toEqual({ token: 'tok', userId: 7 })
  const request = requests[0]
  expect(request?.url).toBe('http://127.0.0.1:3021/__vois-bridge/login')
  expect(request?.method).toBe('POST')
  expect(JSON.parse(v.parse(v.string(), request?.body))).toEqual(credentials)
})

test('loginDebugAccount passes the login failure message through', async () => {
  const failing = loginDebugAccount(
    3021,
    credentials,
    fetchJson(502, { error: '账号或密码错误，请重新输入' }),
  )
  await expect(failing).rejects.toThrow('账号或密码错误，请重新输入')
})
