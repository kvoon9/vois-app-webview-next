import * as v from 'valibot'
import { expect, test } from 'vite-plus/test'

import { apiBaseUrl, buildSignedUrl, callVoisApi, generateV2Query } from '../src/api.ts'
import type { FetchLike } from '../src/debug-server.ts'
import type { JsonValue } from '../src/json.ts'

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
    requests.push({
      url,
      method: init?.method,
      body: init?.body === undefined ? undefined : v.parse(v.string(), init?.body),
    })
    return new Response(JSON.stringify(payload), { status })
  }
  return { requests, fetchImpl }
}

test('generateV2Query signs md5(et + appKey) characters 12 to 20', () => {
  const query = generateV2Query('102070', 'f956a4edc886d8402807a60f89a4a626', 1696000000000)
  expect(query).toEqual({ appid: '102070', et: '1696000000', sign: 'd66372e2' })
})

test('apiBaseUrl joins origins and paths both ways', () => {
  expect(apiBaseUrl('https://api.example.com', '/v2/x').toString()).toBe(
    'https://api.example.com/v2/x',
  )
  expect(apiBaseUrl('https://api.example.com/', 'v2/x').toString()).toBe(
    'https://api.example.com/v2/x',
  )
})

test('buildSignedUrl carries the auth triple and the token', () => {
  const url = buildSignedUrl({
    apiBase: 'https://api.example.com',
    path: '/v2/x',
    appId: 'app',
    appKey: 'key',
    token: 'tok',
    nowMs: 1696000000000,
  })
  expect(url.searchParams.get('appid')).toBe('app')
  expect(url.searchParams.get('et')).toBe('1696000000')
  expect(url.searchParams.get('sign')).toBe(generateV2Query('app', 'key', 1696000000000).sign)
  expect(url.searchParams.get('token')).toBe('tok')
})

test('callVoisApi posts the JSON body and parses the envelope', async () => {
  const { requests, fetchImpl } = recordingFetch(200, { errcode: 0, errmsg: '', data: { ok: 1 } })
  const result = await callVoisApi({
    apiBase: 'https://api.example.com',
    path: '/v2/x',
    method: 'POST',
    body: { a: 1 },
    query: { page: 2 },
    appId: 'app',
    appKey: 'key',
    token: 'tok',
    fetchImpl,
  })
  const request = requests[0]
  expect(result.httpStatus).toBe(200)
  expect(result.isJson).toBe(true)
  expect(result.body).toEqual({ errcode: 0, errmsg: '', data: { ok: 1 } })
  expect(new URL(request?.url ?? 'https://x.invalid').searchParams.get('page')).toBe('2')
  expect(JSON.parse(request?.body ?? 'null')).toEqual({ a: 1 })
})

test('callVoisApi refuses caller query on the reserved auth keys', async () => {
  const { requests, fetchImpl } = recordingFetch(200, { errcode: 0, errmsg: '', data: {} })
  await callVoisApi({
    apiBase: 'https://api.example.com',
    path: '/v2/x',
    method: 'POST',
    query: { token: 'EVIL', appid: '999', et: '0', sign: 'BAD', TOKEN: 'evil-again', keep: 'yes' },
    appId: 'app',
    appKey: 'key',
    token: 'tok',
    fetchImpl,
  })
  const params = new URL(requests[0]?.url ?? 'https://x.invalid').searchParams
  expect(params.get('token')).toBe('tok')
  expect(params.get('appid')).toBe('app')
  expect(params.get('et')).toBe(generateV2Query('app', 'key').et)
  expect(params.get('sign')).toBe(generateV2Query('app', 'key').sign)
  expect(params.get('keep')).toBe('yes')
})

test('callVoisApi keeps non-JSON answers as text instead of throwing', async () => {
  const fetchImpl: FetchLike = async () => new Response('<html>502</html>', { status: 502 })
  const result = await callVoisApi({
    apiBase: 'https://api.example.com',
    path: '/v2/x',
    method: 'GET',
    appId: 'app',
    appKey: 'key',
    token: 'tok',
    fetchImpl,
  })
  expect(result.httpStatus).toBe(502)
  expect(result.isJson).toBe(false)
  expect(result.body).toBe('<html>502</html>')
})

test('callVoisApi propagates network failures to the caller', async () => {
  const fetchImpl: FetchLike = async () => {
    throw new Error('ECONNRESET')
  }
  const failing = callVoisApi({
    apiBase: 'https://api.example.com',
    path: '/v2/x',
    method: 'POST',
    appId: 'app',
    appKey: 'key',
    token: 'tok',
    fetchImpl,
  })
  await expect(failing).rejects.toThrow('ECONNRESET')
})
