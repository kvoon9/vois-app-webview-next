import { describe, expect, it } from 'vite-plus/test'
import { captureLoginId, getLoginId, parseLoginId } from './login-id'

describe('parseLoginId', () => {
  it('reads a positive safe integer from search or hash route queries', () => {
    expect(parseLoginId('?theme=dark&login-id=441')).toBe(441)
    expect(parseLoginId('#/settings?theme=dark&login-id=442')).toBe(442)
  })

  it.each([
    '',
    '?login-id=',
    '?login-id=0',
    '?login-id=-1',
    '?login-id=1.5',
    '?login-id=9007199254740992',
  ])('rejects invalid input: %s', (search) => {
    expect(parseLoginId(search)).toBeNull()
  })

  it('keeps the launch login id after route queries are dropped', () => {
    captureLoginId('#/settings?login-id=443')
    expect(getLoginId()).toBe(443)
  })
})
