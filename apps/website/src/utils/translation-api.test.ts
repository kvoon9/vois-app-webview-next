import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  changeGroupMember,
  changeTranslationTarget,
  getGroupMembers,
  getTranslationLanguages,
  getTranslationTarget,
  getTranslationTargets,
} from './translation-api'

const weilaFetch = vi.hoisted(() => vi.fn())

vi.mock('~/utils/api', () => ({ weilaFetch }))

const friend = {
  user_id: 2,
  user_num: 'V002',
  nick: 'Member',
  avatar: '',
  state: 0,
  skill: 0,
  source: '',
  target: '',
}

describe('translation API', () => {
  beforeEach(() => {
    weilaFetch.mockReset()
  })

  it('inherits group languages for members without overrides', async () => {
    weilaFetch.mockResolvedValue({
      data: {
        group_id: 99,
        source: 'fr-FR',
        target: 'de-DE',
        members: [
          friend,
          {
            ...friend,
            user_id: 3,
            source: 'ja-JP',
            target: 'fr-FR',
          },
        ],
      },
    })

    await expect(getGroupMembers(441, 99)).resolves.toMatchObject({
      groupId: 99,
      source: 'fr-FR',
      target: 'de-DE',
      members: [
        { id: 2, source: 'fr-FR', target: 'de-DE' },
        { id: 3, source: 'ja-JP', target: 'fr-FR' },
      ],
    })
  })

  it('toggles with state and keeps the stored skill on an off write', async () => {
    weilaFetch.mockResolvedValue({ data: { friend } })

    await changeTranslationTarget('friends', 441, 2, {
      state: 0,
      skill: 3,
      source: 'zh-CN',
      target: 'en-US',
    })

    expect(weilaFetch).toHaveBeenCalledWith('/v2/account/translate/change-friend', {
      body: {
        user_id: 441,
        friend_id: 2,
        state: 0,
        skill: 3,
        source: 'zh-CN',
        target: 'en-US',
      },
    })

    await changeTranslationTarget('friends', 441, 2, {
      state: 1,
      skill: 2,
      source: 'zh-CN',
      target: 'en-US',
    })

    expect(weilaFetch).toHaveBeenLastCalledWith('/v2/account/translate/change-friend', {
      body: {
        user_id: 441,
        friend_id: 2,
        state: 1,
        skill: 2,
        source: 'zh-CN',
        target: 'en-US',
      },
    })
  })

  it('maps group updates and extracts supported languages', async () => {
    weilaFetch
      .mockResolvedValueOnce({
        data: {
          group: {
            group_id: 99,
            name: 'Group',
            avatar: '',
            skill: 2,
            source: 'zh-CN',
            target: 'en-US',
          },
        },
      })
      .mockResolvedValueOnce({ data: { langs: ['zh-CN', 'en-US'] } })

    await expect(
      changeTranslationTarget('groups', 441, 99, {
        state: 1,
        skill: 2,
        source: 'zh-CN',
        target: 'en-US',
      }),
    ).resolves.toMatchObject({ id: 99, number: '' })

    expect(weilaFetch).toHaveBeenNthCalledWith(1, '/v2/account/translate/change-group', {
      body: {
        user_id: 441,
        group_id: 99,
        state: 1,
        skill: 2,
        source: 'zh-CN',
        target: 'en-US',
      },
    })
    await expect(getTranslationLanguages()).resolves.toEqual(['zh-CN', 'en-US'])
    expect(weilaFetch).toHaveBeenNthCalledWith(2, '/v2/account/translate/get-countries-lang')
  })

  it('sends member language overrides without a skill', async () => {
    weilaFetch.mockResolvedValue({
      data: {
        member: { ...friend, source: 'de-DE', target: 'fr-FR' },
      },
    })

    await changeGroupMember(441, 99, 2, 'de-DE', 'fr-FR')

    expect(weilaFetch).toHaveBeenCalledWith('/v2/account/translate/change-group-member', {
      body: {
        user_id: 441,
        group_id: 99,
        member_id: 2,
        source: 'de-DE',
        target: 'fr-FR',
      },
    })
  })

  it('reads a single friend instead of the roster', async () => {
    weilaFetch.mockResolvedValue({
      data: { friend: { ...friend, user_id: 97359, nick: '微软翻译' } },
    })

    await expect(getTranslationTarget('friends', 441, 97359)).resolves.toMatchObject({
      id: 97359,
      name: '微软翻译',
    })
    expect(weilaFetch).toHaveBeenCalledWith('/v2/account/translate/get-friend', {
      body: { user_id: 441, friend_id: 97359 },
    })
  })

  it('reads the toggle from state, not from the stored skill', async () => {
    weilaFetch.mockResolvedValue({
      data: { friend: { ...friend, state: 0, skill: 3 } },
    })

    await expect(getTranslationTarget('friends', 441, 97359)).resolves.toMatchObject({
      state: 0,
      skill: 3,
    })
  })

  it('falls back to the skill while groups do not report a state', async () => {
    weilaFetch.mockResolvedValue({
      data: {
        groups: [
          { group_id: 99, name: 'Group', avatar: '', skill: 2, source: 'zh-CN', target: 'en-US' },
        ],
      },
    })

    await expect(getTranslationTargets('groups', 441)).resolves.toMatchObject([
      { id: 99, state: 1, skill: 2 },
    ])
  })

  it('treats a missing friend as not found', async () => {
    weilaFetch.mockResolvedValue({ data: { friend: null } })

    await expect(getTranslationTarget('friends', 441, 1)).resolves.toBeNull()
  })
})
