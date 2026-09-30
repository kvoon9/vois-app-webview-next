import { expect, test } from 'vite-plus/test'

import { countByType, formatDebugEvent, readEventsFile, selectEvents } from '../src/events.ts'

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
