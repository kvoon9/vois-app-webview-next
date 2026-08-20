import { describe, expect, it } from 'vite-plus/test'
import { parseAccountId } from './useAccountId'

describe('parseAccountId', () => {
  it('reads a positive safe integer', () => {
    expect(parseAccountId('441')).toBe(441)
  })

  it.each(['', null, undefined, '0', '-1', '1.5', 'abc', '9007199254740992'])(
    'rejects invalid input: %s',
    (value) => {
      expect(parseAccountId(value)).toBeNull()
    },
  )
})
