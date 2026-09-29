import { describe, expect, it } from 'vite-plus/test'
import { H5_CONTEXT_STATE_KEY, mergeH5Context, readH5Context } from './useNavigationContext'

describe('readH5Context', () => {
  it.each([null, undefined, 'nope', 42, []])('reads nothing from %s', (state) => {
    expect(readH5Context(state)).toStrictEqual({})
  })

  it('reads the account the entry carries', () => {
    expect(readH5Context({ [H5_CONTEXT_STATE_KEY]: { accountId: 441 } })).toStrictEqual({
      accountId: 441,
    })
  })

  it('ignores unrelated history keys', () => {
    expect(
      readH5Context({ back: '/help', position: 2, scroll: { left: 0, top: 12 } }),
    ).toStrictEqual({})
  })

  it('drops fields the context no longer carries', () => {
    const state = { [H5_CONTEXT_STATE_KEY]: { accountId: 441, title: 'Kitchen phone' } }
    expect(readH5Context(state)).toStrictEqual({ accountId: 441 })
  })

  it('drops a malformed context', () => {
    expect(readH5Context({ [H5_CONTEXT_STATE_KEY]: { accountId: '441' } })).toStrictEqual({})
  })
})

describe('mergeH5Context', () => {
  it('keeps the current account when the patch is empty', () => {
    const { state } = mergeH5Context({ accountId: 441 })
    expect(state[H5_CONTEXT_STATE_KEY]).toStrictEqual({ accountId: 441 })
  })

  it('lets the patch override the account', () => {
    const { state } = mergeH5Context({ accountId: 441 }, { accountId: 7 })
    expect(state[H5_CONTEXT_STATE_KEY]).toStrictEqual({ accountId: 7 })
  })

  it('removes an account the patch clears', () => {
    const { state } = mergeH5Context({ accountId: 441 }, { accountId: undefined })
    expect(state[H5_CONTEXT_STATE_KEY]).toStrictEqual({})
  })

  it('writes no history key of its own', () => {
    expect(Object.keys(mergeH5Context({ accountId: 441 }).state)).toEqual([H5_CONTEXT_STATE_KEY])
  })

  it('round-trips through readH5Context', () => {
    const { state } = mergeH5Context({}, { accountId: 7 })
    expect(readH5Context(state)).toStrictEqual({ accountId: 7 })
  })
})
