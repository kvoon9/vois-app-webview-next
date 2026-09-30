import { join } from 'node:path'
import { expect, test } from 'vite-plus/test'

import { findRepoRoot, parseEnvFile, resolveConfig } from '../src/config.ts'

test('parseEnvFile reads KEY=VALUE lines and skips comments', () => {
  const values = parseEnvFile(
    ['# comment', '', 'VITE_APP_ID=102070', 'SPACED =  value ', 'broken line'].join('\n'),
  )
  expect(values.get('VITE_APP_ID')).toBe('102070')
  expect(values.get('SPACED')).toBe('value')
  expect(values.size).toBe(2)
})

test('findRepoRoot walks up to the workspace root', () => {
  const root = findRepoRoot(process.cwd())
  expect(root).toBeDefined()
  expect(join(root!, 'pnpm-workspace.yaml')).toBeTruthy()
  expect(findRepoRoot('/')).toBeUndefined()
})

test('resolveConfig defaults to the built-in app pair and ports', () => {
  const config = resolveConfig({}, {}, '/nonexistent/.env')
  expect(config.appId).toBe('102070')
  expect(config.ports).toEqual([3021, 5173, 8080])
  expect(config.apiBase).toBe('https://api.voischat.cn')
  expect(config.fixedAccount.account).toBe('16675441248')
})

test('resolveConfig prefers VOIS_, then VITE_, then the .vois env file', () => {
  const fromVoisFile = resolveConfig({}, {}, 'tests/fixtures/vois.env')
  expect(fromVoisFile.appId).toBe('from-file')

  const fromViteEnv = resolveConfig({ VITE_APP_ID: 'from-vite' }, {}, 'tests/fixtures/vois.env')
  expect(fromViteEnv.appId).toBe('from-vite')

  const fromVoisEnv = resolveConfig(
    { VITE_APP_ID: 'from-vite', VOIS_APP_ID: 'from-vois' },
    {},
    'tests/fixtures/vois.env',
  )
  expect(fromVoisEnv.appId).toBe('from-vois')
})

test('resolveConfig honors port and file overrides', () => {
  const overridden = resolveConfig(
    {},
    { ports: [4000], eventsFile: '/tmp/e.jsonl' },
    '/nonexistent/.env',
  )
  expect(overridden.ports).toEqual([4000])
  expect(overridden.eventsFile).toBe('/tmp/e.jsonl')

  const fromEnv = resolveConfig(
    { VOIS_DEBUG_PORTS: ' 4001 , nope, 4002 ' },
    {},
    '/nonexistent/.env',
  )
  expect(fromEnv.ports).toEqual([4001, 4002])
})

test('resolveConfig lets env replace the fixed debug account', () => {
  const config = resolveConfig(
    { VOIS_DEBUG_ACCOUNT: '13800000000', VOIS_DEBUG_PASSWORD: 'secret' },
    {},
    '/nonexistent/.env',
  )
  expect(config.fixedAccount).toEqual({
    account: '13800000000',
    password: 'secret',
    countryCode: '86',
  })
})
