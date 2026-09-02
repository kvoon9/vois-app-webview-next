import { weilaFetch } from '~/utils/api'

/** A device that is currently connected to the account. */
export interface Device {
  userId: number
  userNum: string
  nick: string
  avatar: string
  product: string
  imei: string
  version: string
  activatedAt: string
  online: boolean
}

/** The compact group representation used by group and device lists. */
export interface Group {
  groupId: number
  num: string
  name: string
  avatar: string
}

export interface GroupInfo extends Group {
  intro: string
  createdAt: string
  memberCount: number
}

export type GroupMemberRole = 'owner' | 'admin' | 'member'

export interface GroupMember {
  userId: number
  userNum: string
  nick: string
  avatar: string
  role: GroupMemberRole
  online: boolean
  signature: string
}

export interface Friend {
  userId: number
  userNum: string
  nick: string
  avatar: string
  online: boolean
}

interface DeviceDto {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  product: string
  imei: string
  version: string
  activated_at: string
  online: boolean
}

interface GroupDto {
  group_id: number
  num: string
  name: string
  avatar: string
}

interface GroupInfoDto extends GroupDto {
  intro: string
  created_at: string
  member_count: number
}

interface GroupMemberDto {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  role: GroupMemberRole
  online: boolean
  signature: string
}

interface FriendDto {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  online: boolean
}

type EmptyData = Record<string, never>
type DeviceUpdateBody = { device_id: number; nick: string; avatar?: string }

/** Return all devices connected to the current account. */
export async function getConnectedDevices(): Promise<Device[]> {
  const response = await weilaFetch<{ devices: DeviceDto[] }>('/v2/device/list-connected')
  return response.data.devices.map(toDevice)
}

export async function updateDevice(
  deviceId: number,
  nick: string,
  avatar?: string,
): Promise<EmptyData> {
  const body: DeviceUpdateBody = { device_id: deviceId, nick }
  if (avatar !== undefined) body.avatar = avatar
  const response = await weilaFetch<EmptyData>('/v2/device/update', { body })
  return response.data
}

/** Return the groups joined by a device. */
export async function getDeviceGroups(deviceId: number): Promise<Group[]> {
  const response = await weilaFetch<{ groups: GroupDto[] }>('/v2/device/groups', {
    body: { device_id: deviceId },
  })
  return response.data.groups.map(toGroup)
}

export async function joinDeviceGroup(deviceId: number, groupId: number): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/device/join-group', {
    body: { device_id: deviceId, group_id: groupId },
  })
  return response.data
}

export async function leaveDeviceGroup(deviceId: number, groupId: number): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/device/leave-group', {
    body: { device_id: deviceId, group_id: groupId },
  })
  return response.data
}

export async function getMyCreatedGroups(): Promise<Group[]> {
  const response = await weilaFetch<{ groups: GroupDto[] }>('/v2/group/my-created')
  return response.data.groups.map(toGroup)
}

export async function getMyJoinedGroups(): Promise<Group[]> {
  const response = await weilaFetch<{ groups: GroupDto[] }>('/v2/group/my-joined')
  return response.data.groups.map(toGroup)
}

export async function searchGroups(keyword: string): Promise<Group[]> {
  const response = await weilaFetch<{ groups: GroupDto[] }>('/v2/group/search', {
    body: { keyword },
  })
  return response.data.groups.map(toGroup)
}

export async function getGroupInfo(groupId: number): Promise<GroupInfo> {
  const response = await weilaFetch<{ group: GroupInfoDto }>('/v2/group/info', {
    body: { group_id: groupId },
  })
  return toGroupInfo(response.data.group)
}

export async function getGroupMembers(groupId: number): Promise<GroupMember[]> {
  const response = await weilaFetch<{ members: GroupMemberDto[] }>('/v2/group/members', {
    body: { group_id: groupId },
  })
  return response.data.members.map(toGroupMember)
}

export async function addGroupMembers(groupId: number, memberIds: number[]): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/group/add-members', {
    body: { group_id: groupId, member_ids: memberIds },
  })
  return response.data
}

export async function removeGroupMember(groupId: number, memberId: number): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/group/remove-member', {
    body: { group_id: groupId, member_id: memberId },
  })
  return response.data
}

export async function updateGroup(
  groupId: number,
  changes: { name?: string; intro?: string; avatar?: string },
): Promise<EmptyData> {
  const body = {
    group_id: groupId,
    ...changes,
  }
  const response = await weilaFetch<EmptyData>('/v2/group/update', { body })
  return response.data
}

export async function getFriends(): Promise<Friend[]> {
  const response = await weilaFetch<{ friends: FriendDto[] }>('/v2/friend/list')
  return response.data.friends.map(toFriend)
}

function toDevice(device: DeviceDto): Device {
  return {
    userId: device.user_id,
    userNum: device.user_num,
    nick: device.nick,
    avatar: device.avatar,
    product: device.product,
    imei: device.imei,
    version: device.version,
    activatedAt: device.activated_at,
    online: device.online,
  }
}

function toGroup(group: GroupDto): Group {
  return {
    groupId: group.group_id,
    num: group.num,
    name: group.name,
    avatar: group.avatar,
  }
}

function toGroupInfo(group: GroupInfoDto): GroupInfo {
  return {
    ...toGroup(group),
    intro: group.intro,
    createdAt: group.created_at,
    memberCount: group.member_count,
  }
}

function toGroupMember(member: GroupMemberDto): GroupMember {
  return {
    userId: member.user_id,
    userNum: member.user_num,
    nick: member.nick,
    avatar: member.avatar,
    role: member.role,
    online: member.online,
    signature: member.signature,
  }
}

function toFriend(friend: FriendDto): Friend {
  return {
    userId: friend.user_id,
    userNum: friend.user_num,
    nick: friend.nick,
    avatar: friend.avatar,
    online: friend.online,
  }
}
