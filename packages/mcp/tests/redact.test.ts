import { expect, test } from 'vite-plus/test'

import { REDACTED, redactJson, redactText } from '../src/redact.ts'

test('redactJson withholds credential keys and keeps the rest', () => {
  expect(
    redactJson({
      token: 't1',
      'access-token': 't2',
      accessToken: 't3',
      password: 'p',
      Authorization: 'Bearer t4',
      keep: 'visible',
      count: 3,
    }),
  ).toEqual({
    token: REDACTED,
    'access-token': REDACTED,
    accessToken: REDACTED,
    password: REDACTED,
    Authorization: REDACTED,
    keep: 'visible',
    count: 3,
  })
})

test('redactJson walks nesting and arrays', () => {
  expect(redactJson({ a: [{ deep: { token: 'x' } }], ok: true })).toEqual({
    a: [{ deep: { token: REDACTED } }],
    ok: true,
  })
})

test('redactJson strips sensitive query parameters from URL strings', () => {
  expect(redactJson('https://api.example.com/v2/x?token=secret&appid=1')).toBe(
    `https://api.example.com/v2/x?token=${encodeURIComponent(REDACTED)}&appid=1`,
  )
})

test('redactJson strips sensitive query parameters from path-only URLs', () => {
  expect(redactJson('/v2/list?access-token=abc&page=1')).toBe(
    `/v2/list?access-token=${encodeURIComponent(REDACTED)}&page=1`,
  )
})

test('redactJson leaves plain strings alone', () => {
  expect(redactJson('just text with ? but no query')).toBe('just text with ? but no query')
})

test('redactText formats and redacts a value for display', () => {
  expect(redactText({ url: 'http://h/p?password=1', n: 2 })).toBe(
    `{"url":"http://h/p?password=${encodeURIComponent(REDACTED)}","n":2}`,
  )
  expect(redactText(undefined)).toBe('')
})
