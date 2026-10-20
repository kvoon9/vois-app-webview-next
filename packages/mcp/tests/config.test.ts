import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vite-plus/test'

import { findRepoRoot, parseEnvFile, resolveConfig } from '../src/config.ts'

const envFixture = fileURLToPath(new URL('./fixtures/vois.env', import.meta.url))

test('parseEnvFile reads KEY=VALUE lines and skips comments', () => {
  const values = parseEnvFile(
    ['# comment', '', 'VITE_APP_ID=fixture-app-id', 'SPACED =  value ', 'broken line'].join('\n'),
  )
  expect(values.get('VITE_APP_ID')).toBe('fixture-app-id')
  expect(values.get('SPACED')).toBe('value')
  expect(values.size).toBe(2)
})

test('findRepoRoot walks up to the workspace root', () => {
  const root = findRepoRoot(process.cwd())
  expect(root).toBeDefined()
  expect(join(root!, 'pnpm-workspace.yaml')).toBeTruthy()
  expect(findRepoRoot('/')).toBeUndefined()
})

test('resolveConfig leaves the signing pair unset when no source provides it', () => {
  const config = resolveConfig({}, {}, '/nonexistent/.env')
  expect(config.appId).toBeUndefined()
  expect(config.appKey).toBeUndefined()
  expect(config.ports).toEqual([3021, 5173, 8080])
  expect(config.apiBase).toBe('https://api.voischat.cn')
  expect(config.fixedAccount.account).toBe('16675441248')
})

test('resolveConfig prefers VOIS_, then VITE_, then the .vois env file', () => {
  const fromVoisFile = resolveConfig({}, {}, envFixture)
  expect(fromVoisFile.appId).toBe('from-file')

  const fromViteEnv = resolveConfig({ VITE_APP_ID: 'from-vite' }, {}, envFixture)
  expect(fromViteEnv.appId).toBe('from-vite')

  const fromVoisEnv = resolveConfig(
    { VITE_APP_ID: 'from-vite', VOIS_APP_ID: 'from-vois' },
    {},
    envFixture,
  )
  expect(fromVoisEnv.appId).toBe('from-vois')
})

test('resolveConfig targets VITE_API_TARGET before VOIS_API_BASE', () => {
  const fromEnv = resolveConfig({ VITE_API_TARGET: 'https://target.example' }, {}, envFixture)
  expect(fromEnv.apiBase).toBe('https://target.example')

  const fromVoisFile = resolveConfig({}, {}, envFixture)
  expect(fromVoisFile.apiBase).toBe('https://file-target.example')

  const fromVoisEnv = resolveConfig(
    { VOIS_API_BASE: 'https://vois.example' },
    {},
    '/nonexistent/.env',
  )
  expect(fromVoisEnv.apiBase).toBe('https://vois.example')

  const blank = resolveConfig({ VITE_API_TARGET: '' }, {}, '/nonexistent/.env')
  expect(blank.apiBase).toBe('https://api.voischat.cn')
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
  // The configured country code is only a fallback: the login tool derives the
  // effective one from the account shape (see tools.test.ts).
  expect(config.fixedAccount).toEqual({
    account: '13800000000',
    password: 'secret',
    countryCode: '86',
  })
})
