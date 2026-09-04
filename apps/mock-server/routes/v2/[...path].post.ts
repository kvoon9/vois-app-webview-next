import { defineEventHandler, readBody } from 'h3'
import {
  createRechargeOrder,
  deviceContacts,
  deviceGroups,
  devices,
  friends,
  groups,
  meId,
  memberships,
  rechargeInfo,
  rechargeRecords,
  deviceLocations,
  deviceTracks,
  users,
  type ContactSettings,
  type Device,
  type DeviceLocation,
  type DeviceContact,
  type Group,
  type GroupMemberRole,
  type Membership,
  type User,
  type TrackFrequency,
  type TrackPoint,
} from '../../server/data.js'

interface RequestBody {
  device_id?: number | string
  group_id?: number | string
  member_id?: number | string
  member_ids?: Array<number | string>
  contact_id?: number | string
  contact_ids?: Array<number | string>
  device_ids?: Array<number | string>
  keyword?: string
  nick?: string
  name?: string
  intro?: string
  avatar?: string
  muted?: boolean
  share_location?: boolean
  broadcast?: boolean
  pinned?: boolean
  remark?: string
  nickname?: string
  date?: string
  frequency?: TrackFrequency
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
  nickname: string
}

interface FriendResponse {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  online: boolean
  registered_at: string
  signature?: string
}

interface ContactResponse extends FriendResponse {
  settings: ContactSettings
  remark: string
}

interface RechargeResponse {
  user_id: number
  nick: string
  product: string
  imei: string
  iccid: string
  expire_at: string
  price: number
}

interface OrderResponse {
  order_id: number
  device_count: number
  total_price: number
}

interface RechargeRecordResponse {
  order_id: number
  amount: number
  status: string
  created_at: string
}

interface LocationResponse extends DeviceLocation {}

type EmptyData = Record<never, never>
type ResponseData =
  | EmptyData
  | { devices: Device[] }
  | { groups: CompactGroup[] }
  | {
      group: CompactGroup &
        Pick<Group, 'intro' | 'created_at'> & {
          member_count: number
          settings: Group['settings']
          my_nickname: string
        }
    }
  | { members: MemberResponse[] }
  | { friends: FriendResponse[] }
  | { users: FriendResponse[] }
  | { contacts: ContactResponse[] }
  | { devices: RechargeResponse[] }
  | { order: OrderResponse }
  | { records: RechargeRecordResponse[] }
  | LocationResponse
  | { points: TrackPoint[] }
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

function getDevice(deviceId: number): Device | undefined {
  return devices.find((device) => device.user_id === deviceId)
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
    nickname: membership.nickname,
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

function friendData(user: User): FriendResponse {
  return {
    user_id: user.user_id,
    user_num: user.user_num,
    nick: user.nick,
    avatar: user.avatar,
    online: user.online,
    registered_at: user.registered_at,
    signature: user.signature,
  }
}

function contactData(contact: DeviceContact): ContactResponse | undefined {
  const user = getUser(contact.user_id)
  if (!user) return undefined
  return {
    ...friendData(user),
    settings: { ...contact.settings },
    remark: contact.remark,
  }
}

function updateDevice(body: RequestBody): ResponseData {
  const device = getDevice(id(body.device_id))
  if (!device) return fail('设备不存在')
  if (body.nick !== undefined) device.nick = body.nick
  if (body.avatar !== undefined) device.avatar = body.avatar
  return {}
}

function isCurrentUserGroupOwner(groupId: number): boolean {
  const group = getGroup(groupId)
  return (
    group?.created_by === meId ||
    memberships
      .get(groupId)
      ?.some((member) => member.user_id === meId && member.role === 'owner') === true
  )
}

function updateGroup(body: RequestBody): ResponseData {
  const groupId = id(body.group_id)
  const group = getGroup(groupId)
  if (!group) return fail('群组不存在')
  if (!isCurrentUserGroupOwner(groupId)) return fail('仅群主可以修改群信息')
  if (body.name !== undefined) group.name = body.name
  if (body.intro !== undefined) group.intro = body.intro
  if (body.avatar !== undefined) group.avatar = body.avatar
  return {}
}

function updateMyNickname(body: RequestBody): ResponseData {
  const groupId = id(body.group_id)
  const nickname = body.nickname?.trim()
  if (!getGroup(groupId)) return fail('群组不存在')
  if (nickname === undefined) return fail('群昵称不能为空')
  const membership = memberships.get(groupId)?.find((member) => member.user_id === meId)
  if (!membership) return fail('你不是群成员')
  membership.nickname = nickname
  return {}
}

function joinGroup(body: RequestBody): ResponseData {
  const deviceId = id(body.device_id)
  const groupId = id(body.group_id)
  if (!getDevice(deviceId)) return fail('设备不存在')
  if (!getGroup(groupId)) return fail('群组不存在')
  const joined = deviceGroups.get(deviceId) ?? []
  deviceGroups.set(deviceId, joined)
  if (!joined.includes(groupId)) joined.push(groupId)
  const members = memberships.get(groupId) ?? []
  memberships.set(groupId, members)
  if (!members.some((member) => member.user_id === deviceId)) {
    members.push({ user_id: deviceId, role: 'member', nickname: getDevice(deviceId)?.nick ?? '' })
  }
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
  const members = memberships.get(groupId)
  if (members)
    memberships.set(
      groupId,
      members.filter((member) => member.user_id !== deviceId),
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
      current.push({ user_id: memberId, role: 'member', nickname: getUser(memberId)?.nick ?? '' })
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

function dissolveGroup(body: RequestBody): ResponseData {
  const groupId = id(body.group_id)
  const group = getGroup(groupId)
  if (!group) return fail('群组不存在')

  // Authentication is intentionally ignored, but the current account can only
  // dissolve a group it created or owns.
  const isOwner =
    group.created_by === meId ||
    memberships.get(groupId)?.some((member) => member.user_id === meId && member.role === 'owner')
  if (!isOwner) return fail('仅群主可以解散群组')

  const index = groups.indexOf(group)
  if (index !== -1) groups.splice(index, 1)
  memberships.delete(groupId)
  for (const [deviceId, groupIds] of deviceGroups) {
    deviceGroups.set(
      deviceId,
      groupIds.filter((candidate) => candidate !== groupId),
    )
  }
  return {}
}

function updateGroupSettings(body: RequestBody): ResponseData {
  const group = getGroup(id(body.group_id))
  if (!group) return fail('群组不存在')
  for (const key of ['muted', 'share_location', 'broadcast', 'pinned'] as const) {
    const value = body[key]
    if (value !== undefined) group.settings[key] = value
  }
  return {}
}

function addContacts(body: RequestBody): ResponseData {
  const deviceId = id(body.device_id)
  if (!getDevice(deviceId)) return fail('设备不存在')
  const current = deviceContacts.get(deviceId) ?? []
  deviceContacts.set(deviceId, current)
  for (const contactId of (body.contact_ids ?? []).map(id)) {
    const user = getUser(contactId)
    if (user && !current.some((contact) => contact.user_id === contactId)) {
      current.push({
        user_id: contactId,
        registered_at: user.registered_at,
        settings: { muted: false, share_location: false, broadcast: false, pinned: false },
        remark: '',
      })
    }
  }
  return {}
}

function removeContact(body: RequestBody): ResponseData {
  const deviceId = id(body.device_id)
  if (!getDevice(deviceId)) return fail('设备不存在')
  const current = deviceContacts.get(deviceId)
  if (current)
    deviceContacts.set(
      deviceId,
      current.filter((contact) => contact.user_id !== id(body.contact_id)),
    )
  return {}
}

function updateContactSettings(body: RequestBody): ResponseData {
  const deviceId = id(body.device_id)
  const contactId = id(body.contact_id)
  if (!getDevice(deviceId)) return fail('设备不存在')
  const contact = deviceContacts.get(deviceId)?.find((item) => item.user_id === contactId)
  if (!contact) return fail('联系人不存在')
  for (const key of ['muted', 'share_location', 'broadcast', 'pinned'] as const) {
    const value = body[key]
    if (value !== undefined) contact.settings[key] = value
  }
  if (body.remark !== undefined) contact.remark = body.remark
  return {}
}

function contactsForDevice(deviceId: number): ContactResponse[] {
  return (deviceContacts.get(deviceId) ?? [])
    .map(contactData)
    .filter((contact): contact is ContactResponse => contact !== undefined)
}

function rechargeDevices(): RechargeResponse[] {
  return rechargeInfo
    .map((info) => {
      const device = getDevice(info.user_id)
      if (!device) return undefined
      return {
        user_id: device.user_id,
        nick: device.nick,
        product: device.product,
        imei: device.imei,
        iccid: info.iccid,
        expire_at: info.expire_at,
        price: info.price,
      }
    })
    .filter((device): device is RechargeResponse => device !== undefined)
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
    case 'device/contacts': {
      if (!getDevice(id(body.device_id))) return fail('设备不存在')
      return ok({ contacts: contactsForDevice(id(body.device_id)) })
    }
    case 'device/add-contacts':
      return response(addContacts(body))
    case 'device/remove-contact':
      return response(removeContact(body))
    case 'device/update-contact-settings':
      return response(updateContactSettings(body))
    case 'device/clear-messages':
      return ok({})
    case 'device/recharge-list':
      return ok({ devices: rechargeDevices() })
    case 'device/recharge-records': {
      const deviceId = id(body.device_id)
      if (!getDevice(deviceId)) return fail('设备不存在')
      return ok({ records: rechargeRecords.get(deviceId) ?? [] })
    }
    case 'device/location': {
      const location = deviceLocations.get(id(body.device_id))
      if (!location) return fail('设备位置不存在')
      return ok({
        ...location,
        fence: location.fence ? { ...location.fence } : null,
      })
    }
    case 'device/track': {
      const deviceId = id(body.device_id)
      if (!deviceLocations.has(deviceId)) return fail('设备位置不存在')
      return ok({ points: deviceTracks.get(deviceId)?.get(body.date ?? '') ?? [] })
    }
    case 'device/update-track-setting': {
      const deviceId = id(body.device_id)
      const location = deviceLocations.get(deviceId)
      if (!location) return fail('设备位置不存在')
      if (!body.frequency) return fail('上报频率无效')
      location.report_frequency = body.frequency
      return ok({})
    }
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
          settings: { ...group.settings },
          my_nickname:
            memberships.get(group.group_id)?.find((member) => member.user_id === meId)?.nickname ??
            '',
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
    case 'group/update-my-nickname':
      return response(updateMyNickname(body))
    case 'group/dissolve':
      return response(dissolveGroup(body))
    case 'group/update-settings':
      return response(updateGroupSettings(body))
    case 'user/search': {
      const keyword = body.keyword ?? ''
      return ok({
        users: friends.filter((user) => user.user_num.includes(keyword)).map(friendData),
      })
    }
    case 'friend/list':
      return ok({ friends: friends.map(friendData) })
    case 'recharge/create-order': {
      const deviceIds = (body.device_ids ?? []).map(id)
      return ok({ order: createRechargeOrder(deviceIds) })
    }
    default:
      return fail('接口不存在')
  }
})
