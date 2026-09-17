import { describe, expect, it } from 'vite-plus/test'
import { ACCESS_TOKEN_PATH } from '../src/utils/auth-token-path'
import { parseAccessToken } from './dev-auth-token'

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

// The debug plugin's `enforce: "pre"` preview fallback answers index.html for any
// dotless GET, which would silently serve HTML instead of the token.
describe('ACCESS_TOKEN_PATH', () => {
  it('contains a dot so the preview fallback skips it', () => {
    expect(ACCESS_TOKEN_PATH).toContain('.')
  })
})
