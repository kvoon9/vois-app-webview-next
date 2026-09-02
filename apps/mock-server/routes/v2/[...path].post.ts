import { defineEventHandler, readBody } from 'h3'
import {
  deviceGroups,
  devices,
  friends,
  groups,
  meId,
  memberships,
  users,
  type Device,
  type Group,
  type GroupMemberRole,
  type Membership,
  type User,
} from '../../server/data.js'

interface RequestBody {
  device_id?: number | string
  group_id?: number | string
  member_id?: number | string
  member_ids?: Array<number | string>
  keyword?: string
  nick?: string
  name?: string
  intro?: string
  avatar?: string
}

interface CompactGroup {
  group_id: number
  num: string
  name: string
  avatar: string
}

interface MemberResponse {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  role: GroupMemberRole
  online: boolean
  signature: string
}

type EmptyData = Record<never, never>
type ResponseData =
  | EmptyData
  | { devices: Device[] }
  | { groups: CompactGroup[] }
  | { group: CompactGroup & Pick<Group, 'intro' | 'created_at'> & { member_count: number } }
  | { members: MemberResponse[] }
  | { friends: User[] }
type ApiResponse = { errcode: number; errmsg: string; data: ResponseData }

const ok = (data: ResponseData): ApiResponse => ({ errcode: 0, errmsg: '', data })
const fail = (errmsg: string): ApiResponse => ({ errcode: 1, errmsg, data: {} })
const response = (data: ResponseData | ApiResponse): ApiResponse =>
  'errcode' in data ? data : ok(data)

function id(value: number | string | undefined): number {
  return Number(value)
}

function compactGroup(group: Group): CompactGroup {
  return {
    group_id: group.group_id,
    num: group.num,
    name: group.name,
    avatar: group.avatar,
  }
}

function getGroup(groupId: number): Group | undefined {
  return groups.find((group) => group.group_id === groupId)
}

function getUser(userId: number): User | undefined {
  return users.find((user) => user.user_id === userId)
}

function memberData(membership: Membership): MemberResponse | undefined {
  const user = getUser(membership.user_id)
  if (!user) return undefined
  return {
    user_id: user.user_id,
    user_num: user.user_num,
    nick: user.nick,
    avatar: user.avatar,
    role: membership.role,
    online: user.online,
    signature: user.signature,
  }
}

function membersFor(groupId: number): MemberResponse[] {
  return (memberships.get(groupId) ?? [])
    .map(memberData)
    .filter((member): member is MemberResponse => member !== undefined)
}

function groupsForDevice(deviceId: number): CompactGroup[] {
  return (deviceGroups.get(deviceId) ?? [])
    .map(getGroup)
    .filter((group): group is Group => group !== undefined)
    .map(compactGroup)
}

function updateDevice(body: RequestBody): ResponseData {
  const device = devices.find((item) => item.user_id === id(body.device_id))
  if (!device) return fail('设备不存在')
  if (body.nick !== undefined) device.nick = body.nick
  if (body.avatar !== undefined) device.avatar = body.avatar
  return {}
}

function updateGroup(body: RequestBody): ResponseData {
  const group = getGroup(id(body.group_id))
  if (!group) return fail('群组不存在')
  if (body.name !== undefined) group.name = body.name
  if (body.intro !== undefined) group.intro = body.intro
  if (body.avatar !== undefined) group.avatar = body.avatar
  return {}
}

function joinGroup(body: RequestBody): ResponseData {
  const deviceId = id(body.device_id)
  const groupId = id(body.group_id)
  if (!devices.some((device) => device.user_id === deviceId)) return fail('设备不存在')
  if (!getGroup(groupId)) return fail('群组不存在')
  const joined = deviceGroups.get(deviceId) ?? []
  deviceGroups.set(deviceId, joined)
  if (!joined.includes(groupId)) joined.push(groupId)
  return {}
}

function leaveGroup(body: RequestBody): ResponseData {
  const deviceId = id(body.device_id)
  const groupId = id(body.group_id)
  const joined = deviceGroups.get(deviceId)
  if (joined)
    deviceGroups.set(
      deviceId,
      joined.filter((item) => item !== groupId),
    )
  return {}
}

function addMembers(body: RequestBody): ResponseData {
  const groupId = id(body.group_id)
  if (!getGroup(groupId)) return fail('群组不存在')
  const memberIds = (body.member_ids ?? []).map(id)
  const current = memberships.get(groupId) ?? []
  memberships.set(groupId, current)
  for (const memberId of memberIds) {
    if (getUser(memberId) && !current.some((member) => member.user_id === memberId)) {
      current.push({ user_id: memberId, role: 'member' })
    }
  }
  return {}
}

function removeMember(body: RequestBody): ResponseData {
  const groupId = id(body.group_id)
  const memberId = id(body.member_id)
  const current = memberships.get(groupId)
  if (current)
    memberships.set(
      groupId,
      current.filter((member) => member.user_id !== memberId),
    )
  return {}
}

export default defineEventHandler(async (event) => {
  const path = event.context.params?.path ?? ''
  const body = (await readBody<RequestBody>(event)) ?? {}

  switch (path) {
    case 'device/list-connected':
      return ok({ devices: devices.map((device) => ({ ...device })) })
    case 'device/update':
      return response(updateDevice(body))
    case 'device/groups':
      return ok({ groups: groupsForDevice(id(body.device_id)) })
    case 'device/join-group':
      return response(joinGroup(body))
    case 'device/leave-group':
      return response(leaveGroup(body))
    case 'group/my-created':
      return ok({ groups: groups.filter((group) => group.created_by === meId).map(compactGroup) })
    case 'group/my-joined':
      return ok({
        groups: groups
          .filter(
            (group) =>
              group.created_by !== meId &&
              memberships.get(group.group_id)?.some((member) => member.user_id === meId),
          )
          .map(compactGroup),
      })
    case 'group/search': {
      const keyword = body.keyword ?? ''
      return ok({
        groups: groups.filter((group) => group.num.includes(keyword)).map(compactGroup),
      })
    }
    case 'group/info': {
      const group = getGroup(id(body.group_id))
      if (!group) return fail('群组不存在')
      return ok({
        group: {
          ...compactGroup(group),
          intro: group.intro,
          created_at: group.created_at,
          member_count: memberships.get(group.group_id)?.length ?? 0,
        },
      })
    }
    case 'group/members':
      return ok({ members: membersFor(id(body.group_id)) })
    case 'group/add-members':
      return response(addMembers(body))
    case 'group/remove-member':
      return response(removeMember(body))
    case 'group/update':
      return response(updateGroup(body))
    case 'friend/list':
      return ok({
        friends: friends.map((friend) => ({
          user_id: friend.user_id,
          user_num: friend.user_num,
          nick: friend.nick,
          avatar: friend.avatar,
          online: friend.online,
        })),
      })
    default:
      return fail('接口不存在')
  }
})
