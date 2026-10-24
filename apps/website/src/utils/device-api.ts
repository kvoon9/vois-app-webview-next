import { weilaFetch } from '~/utils/api'

/** The SIM card a device runs on; only present for devices that have one. */
export interface SimCard {
  iccid: string
  expiryDate: string
  /** True when the backend considers the card out of credit. */
  recharge: boolean
}

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
  simCard: SimCard | null
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

/** The compact group representation used by group and device lists. */
export interface Group {
  groupId: number
  num: string
  name: string
  avatar: string
  isCreator: boolean
  isAdmin: boolean
  /** Whether joining this group requires owner/admin approval. */
  isAudit: boolean
}

/**
 * Group profile assembled from list + member endpoints. `intro` and
 * `createdAt` have no real endpoint yet (see the feasibility doc), so they
 * stay empty until the backend adds `group-get`.
 */
export interface GroupInfo extends Group {
  intro: string
  createdAt: string
  memberCount: number
  settings: GroupSettings
  myNickname: string
}

export interface GroupMember {
  userId: number
  userNum: string
  nick: string
  avatar: string
  isAdmin: boolean
  /** The member's in-group card name (`remark` upstream). */
  nickname: string
}

/** Track report frequency; numbers on the wire (0 off, 1 low, 2 mid, 3 high). */
export type TrackFrequency = 'off' | 'low' | 'mid' | 'high'

const TRACK_MODES = { off: 0, low: 1, mid: 2, high: 3 } as const satisfies Record<
  TrackFrequency,
  number
>

export interface DeviceFence {
  id: number
  enable: boolean
  name: string
  lng: number
  lat: number
  /** Meters. */
  radius: number
}

/** One point of a day's track. */
export interface TrackPoint {
  lng: number
  lat: number
  /** `YYYY-MM-DD HH:mm:ss` in the device's timezone. */
  time: string
  /** Accuracy radius in meters. */
  radius: number
  /** 0 = gcj02 (AMap), 1 = wgs84 (GPS). */
  coordType: 0 | 1
}

export interface Friend {
  userId: number
  userNum: string
  nick: string
  avatar: string
  online: boolean
  /** The device's remark for this friend, as returned (empty when unset). */
  remark?: string
  /** Registration date (`YYYY-MM-DD`) from the subuser endpoints. */
  registeredAt?: string
  /** Some user responses include the profile signature. */
  signature?: string
}

export type EmergencyContactType = 'friend' | 'phone'

/** One SOS contact of a device: a Weila friend or a raw phone entry. */
export interface EmergencyContact {
  type: EmergencyContactType
  /** Friend contacts: the friend's user id; phone contacts: 0. */
  userId: number
  name: string
  /** Weila number or phone number; identifies the contact for deletion. */
  number: string
  avatar: string
}

export interface EmergencyQuota {
  friendMax: number
  phoneMax: number
  sosRemaining: number
}

/** A SIM card that is due for renewal (`simcard-get-all-need-renew`). */
export interface RenewSimCard {
  iccid: string
  expiryDate: string
  product: string
  imei: string
  userNum: string
  userNick: string
}

/** One created renewal order (`simcard-create-renew-order`). */
export interface RenewOrderResult {
  orderNo: string
  /** Fen (分). */
  amount: number
  currency: string
  productId: string
  productName: string
  productDesc: string
}

/** One historical renewal order (`simcard-get-all-renew-order`). */
export interface RenewOrderRecord {
  orderNo: string
  /** Fen (分). */
  amount: number
  status: number
  chargeStatus: number
  orderDesc: string
  iccid: string
  createdAt: string
}

export type ReminderRepeat = 'once' | 'daily' | 'weekdays' | 'custom' | 'monthly'

/** Day numbers the reminder API stores; 1 is Monday and 7 is Sunday. */
const WEEKDAYS = [1, 2, 3, 4, 5]
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7]

/** Repeat types the reminder endpoints accept alongside a day set. */
const REPEAT_TYPES = {
  once: 0,
  daily: 1,
  weekdays: 2,
  custom: 2,
  monthly: 3,
} satisfies Record<ReminderRepeat, number>

export interface DeviceReminder {
  reminderId: number
  /** HH:mm */
  time: string
  content: string
  repeat: ReminderRepeat
  /** Weekly (1-7, Monday first) or monthly (1-31) day numbers; empty otherwise. */
  repeatDays: number[]
  /** Seconds. */
  ringDuration: number
  /** Times. */
  repeatCount: number
  /** Minutes. */
  repeatInterval: number
}

interface SimCardDto {
  iccid?: string
  expiry_date?: string
  recharge?: boolean
}

interface DeviceDto {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  product: string
  imei: string
  version: string
  sdk_version?: string
  active_at?: string
  online: boolean
  location_share?: boolean
  sim_card?: SimCardDto
}

interface SubuserGroupDto {
  group_id: number
  num: string
  name: string
  avatar: string
  is_creator?: boolean
  is_admin?: boolean
  is_audit?: boolean
}

interface SubuserGroupMemberDto {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  remark?: string
  is_admin?: boolean
  created_at?: string
}

interface SubuserFriendDto {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  remark?: string
  created_at?: string
}

/**
 * The wire answer is one fence object, `null`, or `[]` when none is set
 * (observed on the real backend); only the object shape is a fence.
 */
type DeviceFenceWire = DeviceFenceDto | null | []

interface DeviceFenceDto {
  id: number
  /** The real backend omits `enable` on fences it created as enabled. */
  enable?: number
  name: string
  latitude: number
  longitude: number
  radius: number
}

interface TrackPointDto {
  lat: number
  lng: number
  radius: number
  type: number
  ts: number
}

interface EmergencyContactDto {
  avatar?: string
  /** Friend user id; 0 for phone contacts. */
  id: number
  name: string
  number: string
  /** 1 = phone contact, 2 = friend contact. */
  type: number
}

interface EmergencyContactsDto {
  contacts: EmergencyContactDto[]
  sos_friend_limit?: number
  sos_phone_limit?: number
  sos_times?: number
}

interface RenewSimCardDto {
  iccid: string
  expiry_date: string
  product: string
  imei: string
  user_num: string
  user_nick: string
}

interface RenewOrderResultDto {
  amount: number
  currency: string
  order_no: string
  product_desc: string
  product_id: string
  product_name: string
}

interface RenewOrderRecordDto {
  amount: number
  status: number
  charge_status: number
  order_no: string
  order_desc: string
  iccid: string
  created: string
}

interface DeviceReminderDto {
  id: number
  user_id: number
  /** The reminder text (`content` in the UI model). */
  name: string
  /** Present on newer responses only; `repeated` carries the same story. */
  repeated_type?: number
  repeated?: number[]
  /** Ring duration in seconds. */
  duration: number
  /** Retrigger gap in seconds. */
  again_interval: number
  /** Retrigger count. */
  again_times: number
  /** HH:mm */
  reminder: string
}

type EmptyData = Record<string, never>

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

/** Return every device the current account manages. */
export async function getConnectedDevices(): Promise<Device[]> {
  const response = await weilaFetch<{ devices: DeviceDto[] }>('/v2/subuser/manager-get-all-device')
  return response.data.devices.map(toDevice)
}

/** Load one device's full profile. */
export async function getDeviceDetail(deviceId: number): Promise<Device> {
  const response = await weilaFetch<{ device: DeviceDto }>('/v2/subuser/device-get-detail', {
    body: { user_id: deviceId },
  })
  return toDevice(response.data.device)
}

/** Change the device's nickname. */
export async function updateDeviceNick(deviceId: number, nick: string): Promise<void> {
  await weilaFetch<EmptyData>('/v2/subuser/device-change-nick', {
    body: { user_id: deviceId, nick },
  })
}

/** Change the device's avatar (upload first, pass the URL here). */
export async function updateDeviceAvatar(deviceId: number, avatar: string): Promise<void> {
  await weilaFetch<EmptyData>('/v2/subuser/device-change-avatar', {
    body: { user_id: deviceId, avatar },
  })
}

/**
 * Change nickname and (optionally) avatar in one call. The two endpoints are
 * separate upstream, so an avatar change means two requests.
 */
export async function updateDevice(deviceId: number, nick: string, avatar?: string): Promise<void> {
  await updateDeviceNick(deviceId, nick)
  if (avatar !== undefined) await updateDeviceAvatar(deviceId, avatar)
}

/** Toggle the device-level location sharing switch. */
export async function updateDeviceShareLocation(
  deviceId: number,
  shareLocation: boolean,
): Promise<void> {
  await weilaFetch<EmptyData>('/v2/subuser/device-change-location-share', {
    body: { user_id: deviceId, location_share: shareLocation },
  })
}

/**
 * Unbind the device from the account. The endpoint answers with the friends
 * that remain afterwards; there is nothing to show from that payload.
 */
export async function unbindDevice(deviceId: number): Promise<void> {
  await weilaFetch('/v2/subuser/device-unbind', { body: { user_id: deviceId } })
}

// ---------------------------------------------------------------------------
// Track + fence
// ---------------------------------------------------------------------------

/** Load one day's track points in chronological order. */
export async function getDeviceTrack(deviceId: number, date: string): Promise<TrackPoint[]> {
  const response = await weilaFetch<{ tracks: TrackPointDto[] }>('/v2/subuser/track-get', {
    body: { user_id: deviceId, date },
  })
  return response.data.tracks.map(toTrackPoint)
}

/** Today's last track point; the "recent location" shown before realtime fixes arrive. */
export async function getRecentTrackPoint(deviceId: number): Promise<TrackPoint | null> {
  const today = formatDate(new Date())
  const points = await getDeviceTrack(deviceId, today)
  return points.length > 0 ? points[points.length - 1]! : null
}

/** Read the device's track report frequency (the power-saving mode). */
export async function getDeviceTrackMode(deviceId: number): Promise<TrackFrequency> {
  const response = await weilaFetch<{ mode: number }>('/v2/subuser/track-get-mode', {
    body: { user_id: deviceId },
  })
  return toTrackMode(response.data.mode)
}

/** Persist the device's track report frequency. */
export async function setDeviceTrackMode(
  deviceId: number,
  frequency: TrackFrequency,
): Promise<void> {
  await weilaFetch<EmptyData>('/v2/subuser/track-set-mode', {
    body: { user_id: deviceId, mode: TRACK_MODES[frequency] },
  })
}

/** The device's single geofence, if one is set. */
export async function getDeviceFence(deviceId: number): Promise<DeviceFence | null> {
  const response = await weilaFetch<{ geofence: DeviceFenceWire }>('/v2/subuser/geofence-get', {
    body: { user_id: deviceId },
  })
  const fence = response.data.geofence
  return fence != null && !Array.isArray(fence) ? toDeviceFence(fence) : null
}

/** Create or replace the device's geofence (one fence per device). */
export async function setDeviceFence(
  deviceId: number,
  fence: { lat: number; lng: number; radius: number; name: string },
): Promise<void> {
  await weilaFetch<EmptyData>('/v2/subuser/geofence-set', {
    body: {
      user_id: deviceId,
      name: fence.name,
      latitude: fence.lat,
      longitude: fence.lng,
      radius: fence.radius,
    },
  })
}

/** Remove the device's geofence. */
export async function deleteDeviceFence(deviceId: number, geofenceId: number): Promise<void> {
  await weilaFetch<EmptyData>('/v2/subuser/geofence-delete', {
    body: { user_id: deviceId, geofence_id: geofenceId },
  })
}

// ---------------------------------------------------------------------------
// Device friends (the device's contact list)
// ---------------------------------------------------------------------------

/** The account's own friends, for pickers. */
export async function getFriends(): Promise<Friend[]> {
  const response = await weilaFetch<{ friends: SubuserFriendDto[] }>(
    '/v2/subuser/manager-get-all-friend',
  )
  return response.data.friends.map(toFriend)
}

/** Return the device's friends; this list is the device's contacts. */
export async function getDeviceFriends(deviceId: number): Promise<Friend[]> {
  const response = await weilaFetch<{ friends: SubuserFriendDto[] }>('/v2/subuser/friend-get-all', {
    body: { user_id: deviceId },
  })
  return response.data.friends.map((friend) => {
    const mapped: Friend = {
      userId: friend.user_id,
      userNum: friend.user_num,
      // The list shows the device's remark when set, else the nick
      nick: friend.remark || friend.nick,
      avatar: friend.avatar,
      online: false,
      remark: friend.remark ?? '',
    }
    if (friend.created_at !== undefined) mapped.registeredAt = friend.created_at
    return mapped
  })
}

/** Search Weila users by number or phone on behalf of the device. */
export async function searchDeviceUsers(deviceId: number, keyword: string): Promise<Friend[]> {
  const response = await weilaFetch<{ users: SubuserFriendDto[] }>(
    '/v2/subuser/friend-search-user',
    { body: { user_id: deviceId, key: keyword } },
  )
  return (response.data.users ?? []).map(toFriend)
}

/** Send a friend application from the device to the user. */
export async function inviteDeviceFriend(
  deviceId: number,
  inviteeId: number,
  detail: string,
): Promise<void> {
  await weilaFetch<EmptyData>('/v2/subuser/friend-invite', {
    body: { user_id: deviceId, invitee_id: inviteeId, detail },
  })
}

/** Remove a friend from the device. */
export async function removeDeviceFriend(deviceId: number, friendId: number): Promise<void> {
  await weilaFetch<EmptyData>('/v2/subuser/friend-delete', {
    body: { user_id: deviceId, friend_id: friendId },
  })
}

/** Change the device's remark for a friend. */
export async function updateFriendRemark(
  deviceId: number,
  friendId: number,
  remark: string,
): Promise<void> {
  await weilaFetch<EmptyData>('/v2/subuser/friend-change-remark', {
    body: { user_id: deviceId, friend_id: friendId, remark },
  })
}

/**
 * ---------------------------------------------------------------------------
 * Emergency (SOS) contacts
 * ---------------------------------------------------------------------------
 */
export interface EmergencyContactList {
  contacts: EmergencyContact[]
  quota: EmergencyQuota
}

export async function getEmergencyContacts(deviceId: number): Promise<EmergencyContactList> {
  const response = await weilaFetch<EmergencyContactsDto>('/v2/subuser/emergency-contact-get', {
    body: { user_id: deviceId },
  })
  const dto = response.data
  return {
    contacts: (dto.contacts ?? []).map(toEmergencyContact),
    quota: {
      friendMax: dto.sos_friend_limit ?? 0,
      phoneMax: dto.sos_phone_limit ?? 0,
      sosRemaining: dto.sos_times ?? 0,
    },
  }
}

/** Add one of the device's friends as an SOS contact. */
export async function addEmergencyFriendContact(deviceId: number, friendId: number): Promise<void> {
  await weilaFetch<EmptyData>('/v2/subuser/emergency-contact-add-friend', {
    body: { user_id: deviceId, friend_id: friendId },
  })
}

/** Add a raw phone number as an SOS contact. */
export async function addEmergencyPhoneContact(
  deviceId: number,
  name: string,
  number: string,
): Promise<void> {
  await weilaFetch<EmptyData>('/v2/subuser/emergency-contact-add-phone', {
    body: { user_id: deviceId, name, number },
  })
}

/** Delete an SOS contact; identified by its number plus kind, not an id. */
export async function removeEmergencyContact(
  deviceId: number,
  number: string,
  type: EmergencyContactType,
): Promise<void> {
  await weilaFetch<EmptyData>('/v2/subuser/emergency-contact-delete', {
    body: { user_id: deviceId, number, type: type === 'phone' ? 1 : 2 },
  })
}

// ---------------------------------------------------------------------------
// SIM card renewal
// ---------------------------------------------------------------------------

/** All SIM cards under the account that are due for renewal. */
export async function getRenewSimCards(): Promise<RenewSimCard[]> {
  const response = await weilaFetch<{ renews: RenewSimCardDto[] }>(
    '/v2/subuser/simcard-get-all-need-renew',
  )
  return (response.data.renews ?? []).map(toRenewSimCard)
}

export interface RenewOrderInput {
  iccid: string
  /** `wechat` on Android, `apple_iap` on iOS; native sends it as a page param. */
  payMethod: string
  /** Bundle id, e.g. `com.voistech.weila`; native sends it as a page param. */
  pkgName: string
}

/** Create one renewal order for one card. Payment itself completes in the app. */
export async function createRenewOrder(input: RenewOrderInput): Promise<RenewOrderResult> {
  const response = await weilaFetch<RenewOrderResultDto>('/v2/subuser/simcard-create-renew-order', {
    body: { iccid: input.iccid, pay_method: input.payMethod, pkg_name: input.pkgName },
  })
  const dto = response.data
  return {
    orderNo: dto.order_no,
    amount: dto.amount,
    currency: dto.currency,
    productId: dto.product_id,
    productName: dto.product_name,
    productDesc: dto.product_desc,
  }
}

/** Every renewal order under the account, newest first. */
export async function getRenewOrderRecords(): Promise<RenewOrderRecord[]> {
  const response = await weilaFetch<{ orders: RenewOrderRecordDto[] }>(
    '/v2/subuser/simcard-get-all-renew-order',
  )
  return (response.data.orders ?? []).map(toRenewOrderRecord)
}

// ---------------------------------------------------------------------------
// Device groups
// ---------------------------------------------------------------------------

/** Return the groups joined by a device. */
export async function getDeviceGroups(deviceId: number): Promise<Group[]> {
  const response = await weilaFetch<{ groups: SubuserGroupDto[] }>('/v2/subuser/group-get-all', {
    body: { user_id: deviceId },
  })
  return response.data.groups.map(toGroup)
}

export async function joinDeviceGroup(
  deviceId: number,
  groupId: number,
  detail?: string,
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/subuser/group-join', {
    body: { user_id: deviceId, group_id: groupId, detail },
  })
  return response.data
}

/** Owner exit dissolves the group server-side; the same endpoint serves both. */
export async function leaveDeviceGroup(deviceId: number, groupId: number): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/subuser/group-exit', {
    body: { user_id: deviceId, group_id: groupId },
  })
  return response.data
}

/** All groups the current account (token) manages, for the device join picker. */
export async function getManagerGroups(): Promise<Group[]> {
  const response = await weilaFetch<{ groups: SubuserGroupDto[] }>(
    '/v2/subuser/manager-get-all-group',
  )
  return response.data.groups.map(toGroup)
}

export async function searchGroups(deviceId: number, keyword: string): Promise<Group[]> {
  const response = await weilaFetch<{ groups: SubuserGroupDto[] }>('/v2/subuser/group-search', {
    body: { user_id: deviceId, key: keyword },
  })
  return response.data.groups.map(toGroup)
}

export async function getGroupMembers(deviceId: number, groupId: number): Promise<GroupMember[]> {
  const response = await weilaFetch<{ members: SubuserGroupMemberDto[] }>(
    '/v2/subuser/group-member-get-all',
    { body: { user_id: deviceId, group_id: groupId } },
  )
  return response.data.members.map(toGroupMember)
}

export async function addGroupMembers(
  deviceId: number,
  groupId: number,
  memberIds: number[],
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/subuser/group-member-invite', {
    body: { user_id: deviceId, group_id: groupId, member_ids: memberIds },
  })
  return response.data
}

export async function removeGroupMember(
  deviceId: number,
  groupId: number,
  memberId: number,
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/subuser/group-member-delete', {
    body: { user_id: deviceId, group_id: groupId, member_ids: [memberId] },
  })
  return response.data
}

export async function updateGroupName(
  deviceId: number,
  groupId: number,
  name: string,
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/subuser/group-change-name', {
    body: { user_id: deviceId, group_id: groupId, name },
  })
  return response.data
}

export async function updateGroupAvatar(
  deviceId: number,
  groupId: number,
  avatar: string,
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/subuser/group-change-avatar', {
    body: { user_id: deviceId, group_id: groupId, avatar },
  })
  return response.data
}

/** Transfer ownership; the device becomes a plain member afterwards. */
export async function transferGroupOwner(
  deviceId: number,
  groupId: number,
  ownerId: number,
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/subuser/group-change-owner', {
    body: { user_id: deviceId, group_id: groupId, owner_id: ownerId },
  })
  return response.data
}

/** Update the device's own in-group card name (`remark` upstream). */
export async function updateMyGroupNickname(
  deviceId: number,
  groupId: number,
  nickname: string,
): Promise<EmptyData> {
  const response = await weilaFetch<EmptyData>('/v2/subuser/group-member-change-remark', {
    body: { user_id: deviceId, group_id: groupId, remark: nickname },
  })
  return response.data
}

/**
 * Assemble a group profile from the list and member endpoints. There is no
 * single `group-get` upstream yet, so `intro`/`createdAt` stay empty and the
 * page hides those rows.
 */
export async function getGroupOverview(deviceId: number, groupId: number): Promise<GroupInfo> {
  const [groups, members] = await Promise.all([
    getDeviceGroups(deviceId),
    getGroupMembers(deviceId, groupId),
  ])
  const base = groups.find((group) => group.groupId === groupId)
  if (!base) throw new Error('group not found')
  const mine = members.find((member) => member.userId === deviceId)
  return {
    ...base,
    intro: '',
    createdAt: '',
    memberCount: members.length,
    // Placeholder until the backend exposes per-session settings (A6).
    settings: { muted: false, shareLocation: false, broadcast: false, pinned: false },
    myNickname: mine?.nickname ?? '',
  }
}

/**
 * ---------------------------------------------------------------------------
 * Reminders (real `ext/rmdr` namespace, keyed by the device's user id)
 * ---------------------------------------------------------------------------
 */
export async function getDeviceReminders(deviceId: number): Promise<DeviceReminder[]> {
  const response = await weilaFetch<{ reminders: DeviceReminderDto[] }>(
    '/v2/ext/rmdr/get-all-reminder',
    { body: { user_id: deviceId } },
  )
  return response.data.reminders.map(toReminder)
}

export interface ReminderInput {
  time: string
  content: string
  repeat: ReminderRepeat
  /** Required for `custom` and `monthly`; the presets derive their own day set. */
  repeatDays?: number[]
  ringDuration: number
  repeatCount: number
  repeatInterval: number
}

export async function createDeviceReminder(deviceId: number, input: ReminderInput): Promise<void> {
  await weilaFetch<EmptyData>('/v2/ext/rmdr/add-reminder', {
    body: { user_id: deviceId, ...toReminderBody(input) },
  })
}

export async function updateDeviceReminder(
  deviceId: number,
  reminderId: number,
  input: ReminderInput,
): Promise<void> {
  await weilaFetch<EmptyData>('/v2/ext/rmdr/change-reminder', {
    body: { id: reminderId, user_id: deviceId, ...toReminderBody(input) },
  })
}

export async function removeDeviceReminder(deviceId: number, reminderId: number): Promise<void> {
  await weilaFetch<EmptyData>('/v2/ext/rmdr/delete-reminder', {
    body: { user_id: deviceId, reminder_ids: [reminderId] },
  })
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toDevice(device: DeviceDto): Device {
  return {
    userId: device.user_id,
    userNum: device.user_num,
    nick: device.nick,
    avatar: device.avatar,
    product: device.product,
    imei: device.imei,
    version: device.version,
    activatedAt: device.active_at ?? '',
    online: device.online,
    shareLocation: device.location_share ?? false,
    simCard: toSimCard(device.sim_card),
  }
}

function toSimCard(card: SimCardDto | undefined): SimCard | null {
  if (!card) return null
  return {
    iccid: card.iccid ?? '',
    expiryDate: card.expiry_date ?? '',
    recharge: card.recharge ?? false,
  }
}

function toGroup(group: SubuserGroupDto): Group {
  return {
    groupId: group.group_id,
    num: group.num,
    name: group.name,
    avatar: group.avatar,
    isCreator: group.is_creator ?? false,
    isAdmin: group.is_admin ?? false,
    isAudit: group.is_audit ?? false,
  }
}

function toGroupMember(member: SubuserGroupMemberDto): GroupMember {
  return {
    userId: member.user_id,
    userNum: member.user_num,
    nick: member.nick,
    avatar: member.avatar,
    isAdmin: member.is_admin ?? false,
    // A name cleared through the API comes back as a single space.
    nickname: member.remark?.trim() ?? '',
  }
}

function toFriend(friend: SubuserFriendDto): Friend {
  const mapped: Friend = {
    userId: friend.user_id,
    userNum: friend.user_num,
    nick: friend.remark || friend.nick,
    avatar: friend.avatar,
    online: false,
    remark: friend.remark ?? '',
  }
  if (friend.created_at !== undefined) mapped.registeredAt = friend.created_at
  return mapped
}

function toDeviceFence(fence: DeviceFenceDto): DeviceFence {
  return {
    id: fence.id,
    enable: fence.enable !== 0,
    name: fence.name,
    lng: fence.longitude,
    lat: fence.latitude,
    radius: fence.radius,
  }
}

/** Unknown or missing modes read as `off`; the wire sends 0..3. */
function toTrackMode(mode: number): TrackFrequency {
  if (mode === 1) return 'low'
  if (mode === 2) return 'mid'
  if (mode === 3) return 'high'
  return 'off'
}

function toTrackPoint(point: TrackPointDto): TrackPoint {
  // SAFETY: the wire field is 0 or 1 (gcj02/wgs84); anything else reads as gcj02.
  const coordType: 0 | 1 = point.type === 1 ? 1 : 0
  return {
    lng: point.lng,
    lat: point.lat,
    time: formatTimestamp(point.ts),
    radius: point.radius,
    coordType,
  }
}

function toEmergencyContact(contact: EmergencyContactDto): EmergencyContact {
  return {
    type: contact.type === 2 ? 'friend' : 'phone',
    userId: contact.id ?? 0,
    name: contact.name,
    number: contact.number,
    avatar: contact.avatar ?? '',
  }
}

function toRenewSimCard(card: RenewSimCardDto): RenewSimCard {
  return {
    iccid: card.iccid,
    expiryDate: card.expiry_date,
    product: card.product,
    imei: card.imei,
    userNum: card.user_num,
    userNick: card.user_nick,
  }
}

function toRenewOrderRecord(record: RenewOrderRecordDto): RenewOrderRecord {
  return {
    orderNo: record.order_no,
    amount: record.amount,
    status: record.status,
    chargeStatus: record.charge_status,
    orderDesc: record.order_desc,
    iccid: record.iccid,
    createdAt: record.created,
  }
}

function toReminder(reminder: DeviceReminderDto): DeviceReminder {
  return {
    reminderId: reminder.id,
    time: reminder.reminder,
    content: reminder.name,
    ...toRepeat(reminder),
    ringDuration: reminder.duration,
    repeatCount: reminder.again_times,
    repeatInterval: Math.round(reminder.again_interval / 60),
  }
}

/**
 * `repeated_type` is authoritative when present; the stored day set says the same
 * thing. A weekly rule whose days are not Monday-Friday is a custom one, and a
 * monthly rule stays monthly so editing another field never rewrites it.
 */
function toRepeat(reminder: DeviceReminderDto): Pick<DeviceReminder, 'repeat' | 'repeatDays'> {
  const days = [...(reminder.repeated ?? [])].sort((a, b) => a - b)
  if (reminder.repeated_type === REPEAT_TYPES.monthly)
    return { repeat: 'monthly', repeatDays: days }
  if (reminder.repeated_type === REPEAT_TYPES.daily) return { repeat: 'daily', repeatDays: days }
  if (reminder.repeated_type === REPEAT_TYPES.once) return { repeat: 'once', repeatDays: [] }
  if (reminder.repeated_type === REPEAT_TYPES.weekdays) {
    const weekdays = days.length === WEEKDAYS.length && days.every((day, i) => day === WEEKDAYS[i])
    return { repeat: weekdays ? 'weekdays' : 'custom', repeatDays: days }
  }
  // Older responses carry only the day set.
  if (days.length === 0) return { repeat: 'once', repeatDays: [] }
  if (days.length === EVERY_DAY.length) return { repeat: 'daily', repeatDays: days }
  const weekdays = days.every((day, i) => day === WEEKDAYS[i])
  return { repeat: weekdays ? 'weekdays' : 'custom', repeatDays: days }
}

/** Weekly and monthly rules carry their own days; the fixed three keep the API's set. */
export function reminderDaysFor(repeat: ReminderRepeat, days: number[]): number[] {
  if (repeat === 'daily') return [...EVERY_DAY]
  if (repeat === 'weekdays') return [...WEEKDAYS]
  if (repeat === 'custom' || repeat === 'monthly') return [...days].sort((a, b) => a - b)
  return []
}

function toReminderBody(input: ReminderInput): Omit<DeviceReminderDto, 'id' | 'user_id'> {
  return {
    name: input.content,
    reminder: input.time,
    repeated_type: REPEAT_TYPES[input.repeat],
    repeated: reminderDaysFor(input.repeat, input.repeatDays ?? []),
    duration: input.ringDuration,
    again_times: input.repeatCount,
    // The UI picks whole minutes; the API stores the gap in seconds.
    again_interval: input.repeatInterval * 60,
  }
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** The track API reports unix seconds; the UI shows `YYYY-MM-DD HH:mm:ss`. */
function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000)
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  const ss = `${date.getSeconds()}`.padStart(2, '0')
  return `${formatDate(date)} ${hh}:${mm}:${ss}`
}
