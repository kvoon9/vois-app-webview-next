import { describe, expect, it } from 'vite-plus/test'
import { mergeAccount } from './accounts'
import type { SavedAccount } from './types'

const bridgeAccount: SavedAccount = {
  key: 'user:1',
  userId: 1,
  num: '10001',
  nick: 'Bridge user',
  avatar: 'https://example.com/avatar.png',
  bridge: true,
}

describe('mergeAccount', () => {
  it('merges Bridge and password sign-ins by user ID while preserving both sources', () => {
    const credentialAccount = { ...bridgeAccount, account: 'alice', bridge: false }
    expect(mergeAccount([bridgeAccount], credentialAccount)).toEqual([
      { ...credentialAccount, bridge: true },
    ])
  })

  it('replaces a legacy account entry once its user ID is known', () => {
    const legacy = {
      ...bridgeAccount,
      key: 'credentials:alice',
      userId: undefined,
      account: 'alice',
    }
    const current = { ...bridgeAccount, account: 'alice' }
    expect(mergeAccount([legacy], current)).toEqual([current])
  })

  it('keeps different users with the same nickname separate', () => {
    const other = { ...bridgeAccount, key: 'user:2', userId: 2 }
    expect(mergeAccount([bridgeAccount], other)).toEqual([other, bridgeAccount])
  })

  it('refreshes a removed avatar and retains the password login name', () => {
    const existing = { ...bridgeAccount, account: 'alice' }
    const refreshed = { ...bridgeAccount, nick: 'New name', avatar: '' }
    expect(mergeAccount([existing], refreshed)).toEqual([{ ...refreshed, account: 'alice' }])
  })
})
