import { expect, test } from 'vite-plus/test'

import type { DebugEvent } from '../src/events.ts'
import {
  agreeUiCapture,
  bridgeTimeline,
  countByType,
  formatAgreement,
  formatBridgeSummary,
  formatBridgeTimeline,
  formatDebugEvent,
  readEventsFile,
  selectEvents,
  summarizeBridge,
} from '../src/events.ts'

const lines = [
  JSON.stringify({ type: 'lifecycle', event: 'load', url: 'http://h/#/login', receivedAt: 0 }),
  JSON.stringify({
    type: 'network',
    method: 'POST',
    url: '/v2/list?token=a',
    status: 200,
    duration: 12,
    receivedAt: 1000,
  }),
  JSON.stringify({
    type: 'console',
    level: 'warn',
    args: ['careful', { token: 'x' }],
    receivedAt: 2000,
  }),
  JSON.stringify({
    type: 'bridge',
    direction: 'send',
    protocol: 'close-page',
    data: {},
    receivedAt: 3000,
  }),
  JSON.stringify({ type: 'error', message: 'boom', receivedAt: 4000 }),
  'not json',
  '',
]

test('readEventsFile decodes lines and counts malformed ones', () => {
  const { events, skipped } = readEventsFile(lines.join('\n'))
  expect(events.map((event) => event.type)).toEqual([
    'lifecycle',
    'network',
    'console',
    'bridge',
    'error',
  ])
  expect(skipped).toBe(1)
})

test('countByType counts in first-seen order', () => {
  const { events } = readEventsFile(lines.join('\n'))
  expect([...countByType(events).entries()]).toEqual([
    ['lifecycle', 1],
    ['network', 1],
    ['console', 1],
    ['bridge', 1],
    ['error', 1],
  ])
})

test('selectEvents filters by type and query and keeps the tail', () => {
  const { events } = readEventsFile(lines.join('\n'))
  const byType = selectEvents(events, { type: 'network', limit: 10 })
  expect(byType.matched).toHaveLength(1)
  expect(byType.selected[0]?.method).toBe('POST')

  const many = Array.from({ length: 30 }, (_, index) => ({
    type: 'network',
    method: 'GET',
    url: `/page/${index}`,
    receivedAt: index,
  }))
  const tail = selectEvents(many, { limit: 5 })
  expect(tail.selected.map((event) => event.url)).toEqual([
    '/page/25',
    '/page/26',
    '/page/27',
    '/page/28',
    '/page/29',
  ])

  const queried = selectEvents(many, { query: 'PAGE/3', limit: 10 })
  expect(queried.matched).toHaveLength(1)
})

test('formatDebugEvent renders each event type', () => {
  const { events } = readEventsFile(lines.join('\n'))
  expect(formatDebugEvent(events[0]!)).toMatch(/^\d{2}:\d{2}:\d{2} load  http:\/\/h\/#\/login$/)
  expect(formatDebugEvent(events[1]!)).toMatch(/^\d{2}:\d{2}:\d{2} \[POST 200 12ms\] \/v2\/list/)
  expect(formatDebugEvent(events[2]!)).toContain('[console:warn] careful {"token":"[redacted]"}')
  expect(formatDebugEvent(events[3]!)).toContain('[bridge:send] close-page {}')
  expect(formatDebugEvent(events[4]!)).toContain('[JS ERROR] boom')
})

test('formatDebugEvent withholds tokens in URLs and bodies', () => {
  const { events } = readEventsFile(lines.join('\n'))
  const formatted = formatDebugEvent(events[1]!)
  expect(formatted).not.toContain('token=a')
  expect(formatted).toContain('token=%5Bredacted%5D')
})

test('formatDebugEvent truncates long values', () => {
  const long = 'x'.repeat(600)
  const formatted = formatDebugEvent({ type: 'error', message: long })
  expect(formatted).not.toContain(long)
  expect(formatted).toContain('(+')
})

const bridgeEvents: DebugEvent[] = [
  {
    type: 'bridge',
    direction: 'send',
    protocol: 'device-get-detail',
    data: { device_id: 1848581 },
    receivedAt: 1000,
  },
  {
    type: 'bridge',
    direction: 'receive',
    protocol: 'device-get-detail',
    data: { errcode: 0, errmsg: 'ok', data: { name: 'wl301010386256' } },
    receivedAt: 1100,
  },
  {
    type: 'bridge',
    direction: 'receive',
    protocol: 'get-page-params',
    data: { errcode: 31, errmsg: 'retry?token=abc', data: {} },
    receivedAt: 1200,
  },
  {
    type: 'network',
    method: 'POST',
    url: '/v2/user/get-my-user-info',
    status: 200,
    responseBody: { errcode: 0, data: { nick_name: '测试账号' } },
    receivedAt: 1300,
  },
]

test('bridgeTimeline keeps protocol, direction, errcode, and redacts errmsg', () => {
  const timeline = bridgeTimeline(bridgeEvents)
  expect(timeline).toHaveLength(3)
  expect(timeline[0]).toMatchObject({
    direction: 'send',
    protocol: 'device-get-detail',
    receivedAt: 1000,
  })
  expect(timeline[0]?.errcode).toBeUndefined()
  expect(timeline[2]?.errcode).toBe(31)
  expect(timeline[2]?.errmsg).toContain('token=%5Bredacted%5D')
  expect(timeline[2]?.errmsg).not.toContain('token=abc')
})

test('summarizeBridge groups by protocol and direction with errcodes and timestamps', () => {
  const summary = summarizeBridge(bridgeEvents)
  expect(summary.total).toBe(3)
  expect(summary.groups).toEqual([
    {
      protocol: 'device-get-detail',
      direction: 'send',
      count: 1,
      errcodes: {},
      firstAt: 1000,
      lastAt: 1000,
    },
    {
      protocol: 'device-get-detail',
      direction: 'receive',
      count: 1,
      errcodes: { '0': 1 },
      firstAt: 1100,
      lastAt: 1100,
    },
    {
      protocol: 'get-page-params',
      direction: 'receive',
      count: 1,
      errcodes: { '31': 1 },
      firstAt: 1200,
      lastAt: 1200,
    },
  ])
  expect(summary.nonZeroErrcodes).toEqual({ '31': 1 })

  const formatted = formatBridgeSummary(summary).join('\n')
  expect(formatted).toContain('bridge summary: 3 events')
  expect(formatted).toContain('non-zero errcodes 31x1')
  expect(formatted).toContain('device-get-detail send x1')
  expect(formatted).toContain('errcodes 31x1')
  expect(formatted).toContain('first 1970-01-01T00:00:01.200Z')
})

test('formatBridgeTimeline renders the newest entries and notes earlier ones', () => {
  const timeline = bridgeTimeline(bridgeEvents)
  const formatted = formatBridgeTimeline(timeline, 2).join('\n')
  expect(formatted).toContain('(+1 earlier)')
  expect(formatted).toContain('receive get-page-params errcode 31')
  expect(formatted).not.toContain('send device-get-detail')
})

test('agreeUiCapture prefers a bridge reply and falls back to a network body', () => {
  const bridged = agreeUiCapture('wl301010386256', bridgeEvents)
  expect(bridged).toMatchObject({
    agreed: true,
    source: 'bridge',
    protocol: 'device-get-detail',
    direction: 'receive',
  })
  expect(formatAgreement(bridged, bridgeEvents.length)).toContain(
    'appears in bridge receive device-get-detail',
  )

  const networked = agreeUiCapture('测试账号', bridgeEvents)
  expect(networked).toMatchObject({ agreed: true, source: 'network' })
  expect(formatAgreement(networked, bridgeEvents.length)).toContain(
    'appears in a network response body',
  )

  expect(agreeUiCapture('not-on-screen', bridgeEvents)).toEqual({
    text: 'not-on-screen',
    agreed: false,
  })
})

test('agreeUiCapture never matches a redacted credential', () => {
  const events: DebugEvent[] = [
    {
      type: 'bridge',
      direction: 'receive',
      protocol: 'get-page-params',
      data: { 'access-token': 'tok-7f3a9c' },
      receivedAt: 1,
    },
  ]
  const agreement = agreeUiCapture('tok-7f3a9c', events)
  expect(agreement.agreed).toBe(false)
  expect(formatAgreement(agreement, events.length)).toContain('not agreed')
})
