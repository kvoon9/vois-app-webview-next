import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { ACCESS_TOKEN_PATH } from '../src/utils/auth-token-path'
import { parseAccessToken, writeTokenToEnv } from './dev-auth-token'

describe('parseAccessToken', () => {
  it('reads the token out of dotenv text', () => {
    expect(parseAccessToken('VITE_APP_ID=1\nVITE_ACCESS_TOKEN=abc.def\n')).toBe('abc.def')
    expect(parseAccessToken('VITE_ACCESS_TOKEN=abc==')).toBe('abc==')
  })

  it('treats a missing, empty, or blank token as absent', () => {
    expect(parseAccessToken('')).toBeNull()
    expect(parseAccessToken('VITE_APP_ID=1\n')).toBeNull()
    expect(parseAccessToken('VITE_ACCESS_TOKEN=\n')).toBeNull()
    expect(parseAccessToken('VITE_ACCESS_TOKEN=   \n')).toBeNull()
  })

  it('drops the hash route the debug plugin leaves on a launch token', () => {
    expect(parseAccessToken('VITE_ACCESS_TOKEN=abc123#/devices\n')).toBe('abc123')
    expect(parseAccessToken('VITE_ACCESS_TOKEN=abc123#/\n')).toBe('abc123')
  })
})

describe('writeTokenToEnv', () => {
  const dirs: string[] = []
  function tempEnv(contents: string | null): string {
    const dir = mkdtempSync(join(tmpdir(), 'vois-token-'))
    dirs.push(dir)
    const file = join(dir, 'webview-access-token.env')
    if (contents !== null) writeFileSync(file, contents)
    return file
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('replaces an existing token and keeps every other line', () => {
    const file = tempEnv('VITE_APP_ID=1\nVITE_ACCESS_TOKEN=old\nVITE_APP_KEY=k\n')
    writeTokenToEnv(file, 'fresh')
    expect(readFileSync(file, 'utf8')).toBe(
      'VITE_APP_ID=1\nVITE_ACCESS_TOKEN=fresh\nVITE_APP_KEY=k\n',
    )
  })

  it('appends the token when the file has none', () => {
    const file = tempEnv('VITE_APP_ID=1\n')
    writeTokenToEnv(file, 'fresh')
    expect(readFileSync(file, 'utf8')).toBe('VITE_APP_ID=1\nVITE_ACCESS_TOKEN=fresh\n')
  })

  it('creates the file when it does not exist yet', () => {
    const file = tempEnv(null)
    writeTokenToEnv(file, 'fresh')
    expect(readFileSync(file, 'utf8')).toBe('VITE_ACCESS_TOKEN=fresh\n')
  })

  it('leaves the file untouched when the token is unchanged', () => {
    const file = tempEnv('VITE_ACCESS_TOKEN=same\n')
    // Vite watches this file, so an identical rewrite would restart the server.
    const before = readFileSync(file, 'utf8')
    writeTokenToEnv(file, 'same')
    expect(readFileSync(file, 'utf8')).toBe(before)
  })
})

// The debug plugin's `enforce: "pre"` preview fallback answers index.html for any
// dotless GET, which would silently serve HTML instead of the token.
describe('ACCESS_TOKEN_PATH', () => {
  it('contains a dot so the preview fallback skips it', () => {
    expect(ACCESS_TOKEN_PATH).toContain('.')
  })
})
