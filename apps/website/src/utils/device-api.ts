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
  shareLocation: boolean
}

/** Settings shared by group and contact conversations. */
export interface ConversationSettings {
  muted: boolean
  shareLocation: boolean
  broadcast: boolean
  pinned: boolean
}

export type GroupSettings = ConversationSettings
export type ContactSettings = ConversationSettings
export type GroupSettingsUpdate = Partial<GroupSettings>
export type ContactSettingsUpdate = Partial<ContactSettings> & { remark?: string }

/** The compact group representation used by group and device lists. */
export interface Group {
  groupId: number
  num: string
  name: string
  avatar: string
  createdByMe: boolean
}

export interface GroupInfo extends Group {
  intro: string
  createdAt: string
  memberCount: number
  settings: GroupSettings
  myNickname: string
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
  nickname: string
}

export type TrackFrequency = 'off' | 'low' | 'mid' | 'high'

export interface DeviceFence {
  lng: number
  lat: number
  radius: number
}

export interface DeviceLocation {
  lng: number
  lat: number
  updatedAt: string
  reportFrequency: TrackFrequency
  fence: DeviceFence | null
}

export interface TrackPoint {
  lng: number
  lat: number
  time: string
}

export interface Friend {
  userId: number
  userNum: string
  nick: string
  avatar: string
  online: boolean
  /** Registration timestamp returned by the upgraded friend/user endpoint. */
  registeredAt?: string
  /** Some user/contact responses include the profile signature. */
  signature?: string
}

/** A friend that has been added to a device's contacts. */
export interface DeviceContact extends Friend {
  registeredAt: string
  settings: ContactSettings
  remark: string
}

/** Short domain alias for code that is already scoped to contacts. */
export type Contact = DeviceContact

export interface RechargeDevice {
  userId: number
  nick: string
  product: string
  imei: string
  iccid: string
  expireAt: string
  price: number
}

export interface RechargeOrder {
  orderId: number
  deviceCount: number
  totalPrice: number
}

export interface RechargeRecord {
  orderId: number
  amount: number
  status: string
  createdAt: string
}

export type EmergencyContactType = 'friend' | 'phone'

/** One emergency contact of a device: either a Weila friend or a raw phone entry. */
export interface EmergencyContact {
  contactId: number
  type: EmergencyContactType
  userId?: number
  userNum?: string
  nick?: string
  avatar?: string
  name: string
  phone: string
}

export interface EmergencyQuota {
  friendMax: number
  phoneMax: number
  sosRemaining: number
}

export type ReminderRepeat = 'once' | 'daily' | 'weekdays'

export interface DeviceReminder {
  reminderId: number
  /** HH:mm */
  time: string
  content: string
  repeat: ReminderRepeat
  /** Seconds. */
  ringDuration: number
  /** Times. */
  repeatCount: number
  /** Minutes. */
  repeatInterval: number
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
  share_location?: boolean
}

interface GroupDto {
  group_id: number
  num: string
  name: string
  avatar: string
  created_by_me?: boolean
}

interface GroupSettingsDto {
  muted?: boolean
  share_location?: boolean
  broadcast?: boolean
  pinned?: boolean
}

interface GroupInfoDto extends GroupDto {
  intro: string
  created_at: string
  member_count: number
  settings?: GroupSettingsDto
  my_nickname?: string
}

interface GroupMemberDto {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  role: GroupMemberRole
  online: boolean
  signature: string
  nickname?: string
}

interface DeviceFenceDto {
  lng: number
  lat: number
  radius: number
}

interface DeviceLocationDto {
  lng: number
  lat: number
  updated_at: string
  report_frequency: TrackFrequency
  fence: DeviceFenceDto | null
}

interface TrackPointDto {
  lng: number
  lat: number
  time: string
}

interface FriendDto {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  online: boolean
  registered_at?: string
  signature?: string
}

interface ContactDto extends FriendDto {
  settings?: GroupSettingsDto
  remark?: string
}

interface RechargeDeviceDto {
  user_id: number
  nick: string
  product: string
  imei: string
  iccid: string
  expire_at: string
  price: number
}

interface RechargeOrderDto {
  order_id: number
  device_count: number
  total_price: number
}

interface RechargeRecordDto {
  order_id: number
  amount: number
  status: string
  created_at: string
}

interface EmergencyContactDto {
  contact_id: number
  type: EmergencyContactType
  user_id?: number
  user_num?: string
  nick?: string
  avatar?: string
  name: string
  phone: string
}

interface EmergencyQuotaDto {
  friend_max: number
  phone_max: number
  sos_remaining: number
}

interface DeviceReminderDto {
  reminder_id: number
  time: string
  content: string
  repeat: ReminderRepeat
  ring_duration: number
  repeat_count: number
  repeat_interval: number
}

type EmptyData = Record<string, never>
type DeviceUpdateBody = { device_id: number; nick: string; avatar?: string }
interface SettingsBody {
  muted?: boolean
  share_location?: boolean
  broadcast?: boolean
  pinned?: boolean
}

type SettingsRequestBody = SettingsBody & {
  group_id?: number
  device_id?: number
  contact_id?: number
  remark?: string
}
type WeilaBody = NonNullable<Parameters<typeof weilaFetch>[1]>['body']

/**
 * The shared fetch helper's original body type predates the boolean settings
 * fields. Keep that compatibility shim local to the device API rather than
 * broadening the request type used by unrelated APIs.
 */
function asWeilaBody(body: SettingsRequestBody): WeilaBody {
  // SAFETY: SettingsRequestBody contains the same JSON scalar fields as the
  // shared helper; boolean settings are required by these endpoint contracts.
  return body as WeilaBody
}

/** Return all devices connected to the current account. */
export async function getConnectedDevices(): Promise<Device[]> {
  const response = await weilaFetch<{ devices: DeviceDto[] }>('/v2/device/list-connected')
  return response.data.devices.map(toDevice)
}

/** Return the connected devices that can be renewed. */
export async function getRechargeDevices(): Promise<RechargeDevice[]> {
  const response = await weilaFetch<{ devices: RechargeDeviceDto[] }>('/v2/device/recharge-list')
  return response.data.devices.map(toRechargeDevice)
}

/** Create one renewal order for the selected devices. */
export async function createRechargeOrder(deviceIds: readonly number[]): Promise<RechargeOrder> {
  const response = await weilaFetch<{ order: RechargeOrderDto }>('/v2/recharge/create-order', {
    body: { device_ids: deviceIds },
  })
  return toRechargeOrder(response.data.order)
}

export async function getRechargeRecords(deviceId: number): Promise<RechargeRecord[]> {
  const response = await weilaFetch<{ records: RechargeRecordDto[] }>(
    '/v2/device/recharge-records',
    { body: { device_id: deviceId } },
  )
  return response.data.records.map(toRechargeRecord)
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

/** Toggle the device-level location sharing switch. */
export async function updateDeviceShareLocation(
  deviceId: number,
  shareLocation: boolean,
): Promise<EmptyData> {
  const body = asWeilaBody({ device_id: deviceId, share_location: shareLocation })
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

export async function dissolveGroup(groupId: number): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/group/dissolve', {
    body: { group_id: groupId },
  })
  return response.data
}

export async function updateGroupSettings(
  groupId: number,
  settings: GroupSettingsUpdate,
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/group/update-settings', {
    body: asWeilaBody({ group_id: groupId, ...toSettingsBody(settings) }),
  })
  return response.data
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

/** Update the current account's in-group card name. */
export async function updateMyGroupNickname(groupId: number, nickname: string): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/group/update-my-nickname', {
    body: { group_id: groupId, nickname },
  })
  return response.data
}

/** Load the device's latest location and its read-only fence. */
export async function getDeviceLocation(deviceId: number): Promise<DeviceLocation> {
  const response = await weilaFetch<DeviceLocationDto>('/v2/device/location', {
    body: { device_id: deviceId },
  })
  return toDeviceLocation(response.data)
}

/** Load one day's track points in chronological order. */
export async function getDeviceTrack(deviceId: number, date: string): Promise<TrackPoint[]> {
  const response = await weilaFetch<{ points: TrackPointDto[] }>('/v2/device/track', {
    body: { device_id: deviceId, date },
  })
  return response.data.points.map(toTrackPoint)
}

/** Persist the device's track reporting frequency. */
export async function updateDeviceTrackSetting(
  deviceId: number,
  frequency: TrackFrequency,
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/device/update-track-setting', {
    body: { device_id: deviceId, frequency },
  })
  return response.data
}

export async function getFriends(): Promise<Friend[]> {
  const response = await weilaFetch<{ friends: FriendDto[] }>('/v2/friend/list')
  return response.data.friends.map(toFriend)
}

export async function getDeviceContacts(deviceId: number): Promise<Contact[]> {
  const response = await weilaFetch<{ contacts: ContactDto[] }>('/v2/device/contacts', {
    body: { device_id: deviceId },
  })
  return response.data.contacts.map(toContact)
}

export async function addDeviceContacts(
  deviceId: number,
  contactIds: readonly number[],
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/device/add-contacts', {
    body: { device_id: deviceId, contact_ids: contactIds },
  })
  return response.data
}

export async function removeDeviceContact(deviceId: number, contactId: number): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/device/remove-contact', {
    body: { device_id: deviceId, contact_id: contactId },
  })
  return response.data
}

export async function searchUsers(keyword: string): Promise<Friend[]> {
  const response = await weilaFetch<{ users: FriendDto[] }>('/v2/user/search', {
    body: { keyword },
  })
  return response.data.users.map(toFriend)
}

export async function updateDeviceContactSettings(
  deviceId: number,
  contactId: number,
  settings: ContactSettingsUpdate,
): Promise<EmptyData> {
  const body: SettingsRequestBody = {
    device_id: deviceId,
    contact_id: contactId,
    ...toSettingsBody(settings),
  }
  if (settings.remark !== undefined) body.remark = settings.remark
  const response = await weilaFetch<EmptyData>('/v2/device/update-contact-settings', {
    body: asWeilaBody(body),
  })
  return response.data
}

export async function clearDeviceMessages(deviceId: number, contactId: number): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/device/clear-messages', {
    body: { device_id: deviceId, contact_id: contactId },
  })
  return response.data
}

export interface EmergencyContactList {
  contacts: EmergencyContact[]
  quota: EmergencyQuota
}

export async function getEmergencyContacts(deviceId: number): Promise<EmergencyContactList> {
  const response = await weilaFetch<{
    contacts: EmergencyContactDto[]
    quota: EmergencyQuotaDto
  }>('/v2/device/emergency-contacts', { body: { device_id: deviceId } })
  return {
    contacts: response.data.contacts.map(toEmergencyContact),
    quota: {
      friendMax: response.data.quota.friend_max,
      phoneMax: response.data.quota.phone_max,
      sosRemaining: response.data.quota.sos_remaining,
    },
  }
}

export async function addEmergencyFriends(
  deviceId: number,
  contactIds: readonly number[],
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/device/add-emergency-friends', {
    body: { device_id: deviceId, contact_ids: contactIds },
  })
  return response.data
}

export async function addEmergencyPhone(
  deviceId: number,
  name: string,
  phone: string,
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/device/add-emergency-phone', {
    body: { device_id: deviceId, name, phone },
  })
  return response.data
}

export async function removeEmergencyContact(
  deviceId: number,
  contactId: number,
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/device/remove-emergency-contact', {
    body: { device_id: deviceId, contact_id: contactId },
  })
  return response.data
}

export async function getDeviceReminders(deviceId: number): Promise<DeviceReminder[]> {
  const response = await weilaFetch<{ reminders: DeviceReminderDto[] }>('/v2/device/reminders', {
    body: { device_id: deviceId },
  })
  return response.data.reminders.map(toReminder)
}

export interface ReminderInput {
  time: string
  content: string
  repeat: ReminderRepeat
  ringDuration: number
  repeatCount: number
  repeatInterval: number
}

export async function createDeviceReminder(
  deviceId: number,
  input: ReminderInput,
): Promise<number> {
  const response = await weilaFetch<{ reminder_id: number }>('/v2/device/create-reminder', {
    body: { device_id: deviceId, ...toReminderBody(input) },
  })
  return response.data.reminder_id
}

export async function updateDeviceReminder(
  reminderId: number,
  input: ReminderInput,
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/device/update-reminder', {
    body: { reminder_id: reminderId, ...toReminderBody(input) },
  })
  return response.data
}

export async function removeDeviceReminder(reminderId: number): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/device/remove-reminder', {
    body: { reminder_id: reminderId },
  })
  return response.data
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
    shareLocation: device.share_location ?? false,
  }
}

function toGroup(group: GroupDto): Group {
  return {
    groupId: group.group_id,
    num: group.num,
    name: group.name,
    avatar: group.avatar,
    createdByMe: group.created_by_me ?? false,
  }
}

function toGroupInfo(group: GroupInfoDto): GroupInfo {
  return {
    ...toGroup(group),
    intro: group.intro,
    createdAt: group.created_at,
    memberCount: group.member_count,
    settings: toSettings(group.settings),
    myNickname: group.my_nickname ?? '',
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
    nickname: member.nickname ?? '',
  }
}

function toFriend(friend: FriendDto): Friend {
  const mapped: Friend = {
    userId: friend.user_id,
    userNum: friend.user_num,
    nick: friend.nick,
    avatar: friend.avatar,
    online: friend.online,
  }
  if (friend.registered_at !== undefined) mapped.registeredAt = friend.registered_at
  if (friend.signature !== undefined) mapped.signature = friend.signature
  return mapped
}

function toContact(contact: ContactDto): Contact {
  return {
    ...toFriend(contact),
    registeredAt: contact.registered_at ?? '',
    settings: toSettings(contact.settings),
    remark: contact.remark ?? '',
  }
}

function toSettings(settings?: GroupSettingsDto): GroupSettings {
  return {
    muted: settings?.muted ?? false,
    shareLocation: settings?.share_location ?? false,
    broadcast: settings?.broadcast ?? false,
    pinned: settings?.pinned ?? false,
  }
}

function toSettingsBody(settings: Partial<ConversationSettings>): SettingsBody {
  const body: SettingsBody = {}
  if (settings.muted !== undefined) body.muted = settings.muted
  if (settings.shareLocation !== undefined) body.share_location = settings.shareLocation
  if (settings.broadcast !== undefined) body.broadcast = settings.broadcast
  if (settings.pinned !== undefined) body.pinned = settings.pinned
  return body
}

function toRechargeDevice(device: RechargeDeviceDto): RechargeDevice {
  return {
    userId: device.user_id,
    nick: device.nick,
    product: device.product,
    imei: device.imei,
    iccid: device.iccid,
    expireAt: device.expire_at,
    price: device.price,
  }
}

function toRechargeOrder(order: RechargeOrderDto): RechargeOrder {
  return {
    orderId: order.order_id,
    deviceCount: order.device_count,
    totalPrice: order.total_price,
  }
}

function toRechargeRecord(record: RechargeRecordDto): RechargeRecord {
  return {
    orderId: record.order_id,
    amount: record.amount,
    status: record.status,
    createdAt: record.created_at,
  }
}

function toDeviceLocation(location: DeviceLocationDto): DeviceLocation {
  return {
    lng: location.lng,
    lat: location.lat,
    updatedAt: location.updated_at,
    reportFrequency: location.report_frequency,
    fence: location.fence
      ? {
          lng: location.fence.lng,
          lat: location.fence.lat,
          radius: location.fence.radius,
        }
      : null,
  }
}

function toTrackPoint(point: TrackPointDto): TrackPoint {
  return {
    lng: point.lng,
    lat: point.lat,
    time: point.time,
  }
}

function toEmergencyContact(contact: EmergencyContactDto): EmergencyContact {
  const mapped: EmergencyContact = {
    contactId: contact.contact_id,
    type: contact.type,
    name: contact.name,
    phone: contact.phone,
  }
  if (contact.user_id !== undefined) mapped.userId = contact.user_id
  if (contact.user_num !== undefined) mapped.userNum = contact.user_num
  if (contact.nick !== undefined) mapped.nick = contact.nick
  if (contact.avatar !== undefined) mapped.avatar = contact.avatar
  return mapped
}

function toReminder(reminder: DeviceReminderDto): DeviceReminder {
  return {
    reminderId: reminder.reminder_id,
    time: reminder.time,
    content: reminder.content,
    repeat: reminder.repeat,
    ringDuration: reminder.ring_duration,
    repeatCount: reminder.repeat_count,
    repeatInterval: reminder.repeat_interval,
  }
}

function toReminderBody(input: ReminderInput): Omit<DeviceReminderDto, 'reminder_id'> {
  return {
    time: input.time,
    content: input.content,
    repeat: input.repeat,
    ring_duration: input.ringDuration,
    repeat_count: input.repeatCount,
    repeat_interval: input.repeatInterval,
  }
}

// These aliases are intentionally small compatibility conveniences for code
// that names the operation from the endpoint rather than the device scope.
export const getDeviceRechargeList = getRechargeDevices
export const getRechargeList = getRechargeDevices
export const createDeviceRechargeOrder = createRechargeOrder
export const getContacts = getDeviceContacts
export const addContacts = addDeviceContacts
export const removeContact = removeDeviceContact
export const updateContactSettings = updateDeviceContactSettings
export const clearMessages = clearDeviceMessages
export const clearContactMessages = clearDeviceMessages
