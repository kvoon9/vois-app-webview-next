import { describe, expect, it, vi } from 'vite-plus/test'
import { applyProfileResult, type ProfileResult, type ProfileSink } from './useAccountProfile'
import type { AccountProfile, CredentialSession } from '~/utils/auth/types'

const PROFILE: AccountProfile = {
  userId: 123,
  num: '441',
  nick: 'Nick',
  avatar: 'https://avatar.example/123.png',
}

function sinkFor(session: CredentialSession | null) {
  const rememberAccount = vi.fn<ProfileSink['rememberAccount']>()
  const selectSession = vi.fn<ProfileSink['selectSession']>()
  const sink: ProfileSink = { session, rememberAccount, selectSession }
  return { sink, rememberAccount, selectSession }
}

describe('applyProfileResult', () => {
  it('ignores a result from a session that is no longer selected', () => {
    const current: CredentialSession = { token: 'current', userId: 123 }
    const { sink, rememberAccount, selectSession } = sinkFor(current)
    const late: ProfileResult = {
      selected: { token: 'late', userId: 456 },
      token: 'late',
      profile: PROFILE,
    }

    applyProfileResult(late, sink)

    expect(rememberAccount).not.toHaveBeenCalled()
    expect(selectSession).not.toHaveBeenCalled()
  })

  it('ignores an empty query result', () => {
    const { sink, rememberAccount, selectSession } = sinkFor(null)

    applyProfileResult(undefined, sink)
    applyProfileResult(null, sink)

    expect(rememberAccount).not.toHaveBeenCalled()
    expect(selectSession).not.toHaveBeenCalled()
  })

  it('records a credential profile and leaves the selected session alone', () => {
    const selected: CredentialSession = {
      token: 'session-token',
      userId: 123,
      account: 'alice',
      source: 'credentials',
    }
    const { sink, rememberAccount, selectSession } = sinkFor(selected)

    applyProfileResult({ selected, token: 'session-token', profile: PROFILE }, sink)

    expect(rememberAccount).toHaveBeenCalledOnce()
    expect(rememberAccount).toHaveBeenCalledWith(
      {
        key: 'user:123',
        userId: 123,
        num: '441',
        nick: 'Nick',
        avatar: 'https://avatar.example/123.png',
        account: 'alice',
        bridge: false,
      },
      {
        token: 'session-token',
        userId: 123,
        account: 'alice',
        source: 'credentials',
      },
    )
    expect(selectSession).not.toHaveBeenCalled()
  })

  it('records a bridge profile with the bridge flag and no account', () => {
    const { sink, rememberAccount, selectSession } = sinkFor(null)

    applyProfileResult({ selected: null, token: 'bridge-token', profile: PROFILE }, sink)

    expect(rememberAccount).toHaveBeenCalledOnce()
    expect(rememberAccount).toHaveBeenCalledWith(
      {
        key: 'user:123',
        userId: 123,
        num: '441',
        nick: 'Nick',
        avatar: 'https://avatar.example/123.png',
        account: undefined,
        bridge: true,
      },
      {
        token: 'bridge-token',
        userId: 123,
        account: undefined,
        source: 'bridge',
      },
    )
    expect(selectSession).not.toHaveBeenCalled()
  })

  it('fills in the user id of a selected session that had none', () => {
    const selected: CredentialSession = { token: 'session-token', account: 'alice' }
    const { sink, rememberAccount, selectSession } = sinkFor(selected)

    applyProfileResult({ selected, token: 'session-token', profile: PROFILE }, sink)

    expect(rememberAccount).toHaveBeenCalledWith(
      {
        key: 'user:123',
        userId: 123,
        num: '441',
        nick: 'Nick',
        avatar: 'https://avatar.example/123.png',
        account: 'alice',
        bridge: false,
      },
      {
        token: 'session-token',
        userId: 123,
        account: 'alice',
        source: 'credentials',
      },
    )
    expect(selectSession).toHaveBeenCalledOnce()
    expect(selectSession).toHaveBeenCalledWith({
      token: 'session-token',
      account: 'alice',
      userId: 123,
      source: 'credentials',
    })
  })
})
