import { weilaFetch } from '~/utils/api'

export type TranslationSkill = 0 | 1 | 2 | 3
export type TranslationTargetKind = 'friends' | 'groups'

export interface TranslationSetting {
  skill: TranslationSkill
  source: string
  target: string
}

export interface TranslationTarget extends TranslationSetting {
  id: number
  number: string
  name: string
  avatar: string
}

interface FriendDto extends TranslationSetting {
  user_id: number
  user_num: string
  nick: string
  avatar: string
}

interface GroupDto extends TranslationSetting {
  group_id: number
  name: string
  avatar: string
}

type ChangeTranslationBody = {
  user_id: number
  friend_id?: number
  group_id?: number
  skill: TranslationSkill
  source?: string
  target?: string
}

type MemberDto = FriendDto

export interface GroupMembers {
  groupId: number
  source: string
  target: string
  members: TranslationTarget[]
}

export async function getTranslationLanguages(): Promise<string[]> {
  const response = await weilaFetch<{ langs: string[] }>('/v2/account/translate/get-countries-lang')
  return response.data.langs
}

export async function getTranslationTargets(
  kind: TranslationTargetKind,
  userId: number,
): Promise<TranslationTarget[]> {
  if (kind === 'friends') {
    const response = await weilaFetch<{ friends: FriendDto[] }>(
      '/v2/account/translate/get-friends',
      { body: { user_id: userId } },
    )
    return response.data.friends.map(toFriendTarget)
  }

  const response = await weilaFetch<{ groups: GroupDto[] }>('/v2/account/translate/get-groups', {
    body: { user_id: userId },
  })
  return response.data.groups.map(toGroupTarget)
}

export async function changeTranslationTarget(
  kind: TranslationTargetKind,
  userId: number,
  targetId: number,
  setting: TranslationSetting,
): Promise<TranslationTarget> {
  const body: ChangeTranslationBody = {
    user_id: userId,
    skill: setting.skill,
  }

  if (kind === 'friends') body.friend_id = targetId
  else body.group_id = targetId

  if (setting.skill !== 0) {
    body.source = setting.source
    body.target = setting.target
  }

  if (kind === 'friends') {
    const response = await weilaFetch<{ friend: FriendDto }>(
      '/v2/account/translate/change-friend',
      { body },
    )
    return toFriendTarget(response.data.friend)
  }

  const response = await weilaFetch<{ group: GroupDto }>('/v2/account/translate/change-group', {
    body,
  })
  return toGroupTarget(response.data.group)
}

export async function getGroupMembers(userId: number, groupId: number): Promise<GroupMembers> {
  const response = await weilaFetch<{
    group_id: number
    source: string
    target: string
    members: MemberDto[]
  }>('/v2/account/translate/get-group-members', {
    body: { user_id: userId, group_id: groupId },
  })

  const members = response.data.members.map((member) => {
    const target = toFriendTarget(member)
    return {
      ...target,
      source: target.source || response.data.source,
      target: target.target || response.data.target,
    }
  })

  return {
    groupId: response.data.group_id,
    source: response.data.source,
    target: response.data.target,
    members,
  }
}

export async function changeGroupMember(
  userId: number,
  groupId: number,
  memberId: number,
  source: string,
  target: string,
): Promise<TranslationTarget> {
  const response = await weilaFetch<{ member: MemberDto }>(
    '/v2/account/translate/change-group-member',
    {
      body: {
        user_id: userId,
        group_id: groupId,
        member_id: memberId,
        source,
        target,
      },
    },
  )
  return toFriendTarget(response.data.member)
}

function toFriendTarget(friend: FriendDto): TranslationTarget {
  return {
    id: friend.user_id,
    number: friend.user_num,
    name: friend.nick,
    avatar: friend.avatar,
    skill: friend.skill,
    source: friend.source,
    target: friend.target,
  }
}

function toGroupTarget(group: GroupDto): TranslationTarget {
  return {
    id: group.group_id,
    number: '',
    name: group.name,
    avatar: group.avatar,
    skill: group.skill,
    source: group.source,
    target: group.target,
  }
}
