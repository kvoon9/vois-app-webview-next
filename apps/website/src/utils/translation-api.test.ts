import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  changeGroupMember,
  changeTranslationTarget,
  getGroupMembers,
  getTranslationLanguages,
} from './translation-api'

const weilaFetch = vi.hoisted(() => vi.fn())

vi.mock('~/utils/api', () => ({ weilaFetch }))

const friend = {
  user_id: 2,
  user_num: 'V002',
  nick: 'Member',
  avatar: '',
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

  it('omits languages only when closing translation', async () => {
    weilaFetch.mockResolvedValue({ data: { friend } })

    await changeTranslationTarget('friends', 441, 2, {
      skill: 0,
      source: 'zh-CN',
      target: 'en-US',
    })

    expect(weilaFetch).toHaveBeenCalledWith('/v2/account/translate/change-friend', {
      body: { user_id: 441, friend_id: 2, skill: 0 },
    })

    await changeTranslationTarget('friends', 441, 2, {
      skill: 2,
      source: 'zh-CN',
      target: 'en-US',
    })

    expect(weilaFetch).toHaveBeenLastCalledWith('/v2/account/translate/change-friend', {
      body: {
        user_id: 441,
        friend_id: 2,
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
        skill: 2,
        source: 'zh-CN',
        target: 'en-US',
      }),
    ).resolves.toMatchObject({ id: 99, number: '' })

    expect(weilaFetch).toHaveBeenNthCalledWith(1, '/v2/account/translate/change-group', {
      body: {
        user_id: 441,
        group_id: 99,
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
})
