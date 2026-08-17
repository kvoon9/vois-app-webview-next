import { describe, expect, it } from 'vite-plus/test'
import { parseLoginId } from './login-id'

describe('parseLoginId', () => {
  it('reads a positive safe integer', () => {
    expect(parseLoginId('?theme=dark&login-id=441')).toBe(441)
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
})
