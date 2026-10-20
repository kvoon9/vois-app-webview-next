import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  addEmergencyFriendContact,
  addEmergencyPhoneContact,
  addGroupMembers,
  createDeviceReminder,
  createRenewOrder,
  deleteDeviceFence,
  getConnectedDevices,
  getDeviceDetail,
  getDeviceFence,
  getDeviceFriends,
  getDeviceGroups,
  getDeviceReminders,
  getDeviceTrack,
  getDeviceTrackMode,
  getEmergencyContacts,
  getFriends,
  getGroupMembers,
  getGroupOverview,
  getManagerGroups,
  getRecentTrackPoint,
  getRenewOrderRecords,
  getRenewSimCards,
  inviteDeviceFriend,
  joinDeviceGroup,
  leaveDeviceGroup,
  removeDeviceFriend,
  removeDeviceReminder,
  removeEmergencyContact,
  removeGroupMember,
  searchDeviceUsers,
  searchGroups,
  setDeviceFence,
  setDeviceTrackMode,
  transferGroupOwner,
  unbindDevice,
  updateDevice,
  updateDeviceAvatar,
  updateDeviceNick,
  updateDeviceReminder,
  updateDeviceShareLocation,
  updateFriendRemark,
  updateGroupName,
  updateGroupAvatar,
  updateMyGroupNickname,
} from './device-api'

const weilaFetch = vi.hoisted(() => vi.fn())

vi.mock('~/utils/api', () => ({ weilaFetch }))

const ok = <T>(data: T) => ({ errcode: 0, errmsg: 'ok', data })

const deviceDto = {
  user_id: 1848581,
  user_num: '3001',
  nick: 'watch',
  avatar: 'http://cdn/a.png',
  product: 'CF03',
  imei: '866',
  version: 'v1.110',
  active_at: '2026-08-28',
  online: true,
  location_share: true,
  sim_card: { iccid: '8986', expiry_date: '2027-11-30', recharge: true },
}

const device = {
  userId: 1848581,
  userNum: '3001',
  nick: 'watch',
  avatar: 'http://cdn/a.png',
  product: 'CF03',
  imei: '866',
  version: 'v1.110',
  activatedAt: '2026-08-28',
  online: true,
  shareLocation: true,
  simCard: { iccid: '8986', expiryDate: '2027-11-30', recharge: true },
}

const apiReminder = {
  id: 116,
  user_id: 1848581,
  name: '吃药',
  repeated_type: 2,
  repeated: [1, 2, 3, 4, 5],
  duration: 60,
  again_interval: 300,
  again_times: 3,
  reminder: '09:30',
}

describe('device API', () => {
  beforeEach(() => {
    weilaFetch.mockReset()
  })

  describe('devices', () => {
    it('maps every managed device and the SIM card it may carry', async () => {
      weilaFetch.mockResolvedValue(
        ok({
          devices: [
            deviceDto,
            {
              user_id: 2,
              user_num: '3002',
              nick: 'phone',
              avatar: '',
              product: 'OP02',
              imei: '861',
              version: 'v2',
              online: false,
            },
          ],
        }),
      )

      await expect(getConnectedDevices()).resolves.toEqual([
        device,
        {
          userId: 2,
          userNum: '3002',
          nick: 'phone',
          avatar: '',
          product: 'OP02',
          imei: '861',
          version: 'v2',
          activatedAt: '',
          online: false,
          shareLocation: false,
          simCard: null,
        },
      ])
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/manager-get-all-device')
    })

    it('loads one device by posting its user_id', async () => {
      weilaFetch.mockResolvedValue(ok({ device: deviceDto }))

      await expect(getDeviceDetail(1848581)).resolves.toEqual(device)
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/device-get-detail', {
        body: { user_id: 1848581 },
      })
    })

    it('posts the new device nick', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await updateDeviceNick(9, '新手表')

      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/device-change-nick', {
        body: { user_id: 9, nick: '新手表' },
      })
    })

    it('posts the new device avatar URL', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await updateDeviceAvatar(9, 'http://cdn/b.png')

      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/device-change-avatar', {
        body: { user_id: 9, avatar: 'http://cdn/b.png' },
      })
    })

    it('skips the avatar endpoint when updateDevice gets no avatar', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await updateDevice(9, '新手表')

      expect(weilaFetch).toHaveBeenCalledTimes(1)
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/device-change-nick', {
        body: { user_id: 9, nick: '新手表' },
      })
    })

    it('changes nick and avatar in two requests', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await updateDevice(9, '新手表', 'http://cdn/b.png')

      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/device-change-nick', {
        body: { user_id: 9, nick: '新手表' },
      })
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/device-change-avatar', {
        body: { user_id: 9, avatar: 'http://cdn/b.png' },
      })
    })

    it('posts the location share switch as a boolean', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await updateDeviceShareLocation(9, true)
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/device-change-location-share', {
        body: { user_id: 9, location_share: true },
      })

      weilaFetch.mockClear()
      await updateDeviceShareLocation(9, false)
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/device-change-location-share', {
        body: { user_id: 9, location_share: false },
      })
    })

    it('unbinds the device by user_id', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await unbindDevice(9)

      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/device-unbind', {
        body: { user_id: 9 },
      })
    })
  })

  describe('track and geofence', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('posts the date and maps ts and coord type onto points', async () => {
      const morning = Math.floor(new Date(2026, 1, 11, 8, 30, 15).getTime() / 1000)
      const evening = Math.floor(new Date(2026, 1, 11, 19, 5, 9).getTime() / 1000)
      weilaFetch.mockResolvedValue(
        ok({
          tracks: [
            { lat: 31.2, lng: 121.4, radius: 30, type: 1, ts: morning },
            { lat: 31.3, lng: 121.5, radius: 10, type: 0, ts: evening },
          ],
        }),
      )

      await expect(getDeviceTrack(9, '2026-02-11')).resolves.toEqual([
        { lng: 121.4, lat: 31.2, time: '2026-02-11 08:30:15', radius: 30, coordType: 1 },
        { lng: 121.5, lat: 31.3, time: '2026-02-11 19:05:09', radius: 10, coordType: 0 },
      ])
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/track-get', {
        body: { user_id: 9, date: '2026-02-11' },
      })
    })

    it('returns the last point of today as the recent location', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 1, 11, 10, 0, 0))
      const morning = Math.floor(new Date(2026, 1, 11, 8, 30, 15).getTime() / 1000)
      const evening = Math.floor(new Date(2026, 1, 11, 19, 5, 9).getTime() / 1000)
      weilaFetch.mockResolvedValue(
        ok({
          tracks: [
            { lat: 31.2, lng: 121.4, radius: 30, type: 0, ts: morning },
            { lat: 31.3, lng: 121.5, radius: 10, type: 0, ts: evening },
          ],
        }),
      )

      await expect(getRecentTrackPoint(9)).resolves.toEqual({
        lng: 121.5,
        lat: 31.3,
        time: '2026-02-11 19:05:09',
        radius: 10,
        coordType: 0,
      })
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/track-get', {
        body: { user_id: 9, date: '2026-02-11' },
      })
    })

    it('resolves null when the day has no track points', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 1, 11, 10, 0, 0))
      weilaFetch.mockResolvedValue(ok({ tracks: [] }))

      await expect(getRecentTrackPoint(9)).resolves.toBeNull()
    })

    it('reads the wire mode numbers as frequencies', async () => {
      const cases = [
        [0, 'off'],
        [1, 'low'],
        [2, 'mid'],
        [3, 'high'],
      ] as const

      for (const [mode, expected] of cases) {
        weilaFetch.mockResolvedValueOnce(ok({ mode }))
        await expect(getDeviceTrackMode(9)).resolves.toBe(expected)
      }
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/track-get-mode', {
        body: { user_id: 9 },
      })
    })

    it('writes frequencies back as wire mode numbers', async () => {
      weilaFetch.mockResolvedValue(ok({}))
      const cases = [
        ['off', 0],
        ['low', 1],
        ['mid', 2],
        ['high', 3],
      ] as const

      for (const [frequency, mode] of cases) {
        weilaFetch.mockClear()
        await setDeviceTrackMode(9, frequency)
        expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/track-set-mode', {
          body: { user_id: 9, mode },
        })
      }
    })

    it('maps latitude/longitude onto lat/lng and enable onto a boolean', async () => {
      weilaFetch
        .mockResolvedValueOnce(
          ok({
            geofence: {
              id: 3,
              enable: 1,
              name: '家',
              latitude: 31.2,
              longitude: 121.4,
              radius: 500,
            },
          }),
        )
        .mockResolvedValueOnce(
          ok({
            geofence: {
              id: 3,
              enable: 0,
              name: '家',
              latitude: 31.2,
              longitude: 121.4,
              radius: 500,
            },
          }),
        )

      await expect(getDeviceFence(9)).resolves.toEqual({
        id: 3,
        enable: true,
        name: '家',
        lng: 121.4,
        lat: 31.2,
        radius: 500,
      })
      await expect(getDeviceFence(9)).resolves.toEqual({
        id: 3,
        enable: false,
        name: '家',
        lng: 121.4,
        lat: 31.2,
        radius: 500,
      })
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/geofence-get', { body: { user_id: 9 } })
    })

    it('resolves null when no fence is set', async () => {
      weilaFetch.mockResolvedValue(ok({ geofence: null }))

      await expect(getDeviceFence(9)).resolves.toBeNull()
    })

    it('posts the fence under the wire field names', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await setDeviceFence(9, { lat: 31.2, lng: 121.4, radius: 500, name: '家' })

      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/geofence-set', {
        body: { user_id: 9, name: '家', latitude: 31.2, longitude: 121.4, radius: 500 },
      })
    })

    it('deletes the fence by geofence_id', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await deleteDeviceFence(9, 3)

      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/geofence-delete', {
        body: { user_id: 9, geofence_id: 3 },
      })
    })
  })

  describe('friends', () => {
    it('maps account friends preferring the remark', async () => {
      weilaFetch.mockResolvedValue(
        ok({
          friends: [
            {
              user_id: 55,
              user_num: '6002',
              nick: '小明',
              remark: '小明明',
              avatar: 'http://cdn/m.png',
              created_at: '2025-01-01',
            },
            { user_id: 56, user_num: '6003', nick: '小红', avatar: '' },
          ],
        }),
      )

      await expect(getFriends()).resolves.toEqual([
        {
          userId: 55,
          userNum: '6002',
          nick: '小明明',
          avatar: 'http://cdn/m.png',
          online: false,
          remark: '小明明',
          registeredAt: '2025-01-01',
        },
        { userId: 56, userNum: '6003', nick: '小红', avatar: '', online: false, remark: '' },
      ])
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/manager-get-all-friend')
    })

    it('shows the device remark as the friend nick', async () => {
      weilaFetch.mockResolvedValue(
        ok({
          friends: [
            {
              user_id: 55,
              user_num: '6002',
              nick: '小明',
              remark: '小明明',
              avatar: '',
              created_at: '2025-01-01',
            },
            { user_id: 56, user_num: '6003', nick: '小红', avatar: '' },
          ],
        }),
      )

      await expect(getDeviceFriends(9)).resolves.toEqual([
        {
          userId: 55,
          userNum: '6002',
          nick: '小明明',
          avatar: '',
          online: false,
          remark: '小明明',
          registeredAt: '2025-01-01',
        },
        { userId: 56, userNum: '6003', nick: '小红', avatar: '', online: false, remark: '' },
      ])
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/friend-get-all', {
        body: { user_id: 9 },
      })
    })

    it('searches users by the key field', async () => {
      weilaFetch.mockResolvedValue(
        ok({ users: [{ user_id: 55, user_num: '6002', nick: '小明', avatar: '' }] }),
      )

      await expect(searchDeviceUsers(9, '6002')).resolves.toEqual([
        { userId: 55, userNum: '6002', nick: '小明', avatar: '', online: false, remark: '' },
      ])
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/friend-search-user', {
        body: { user_id: 9, key: '6002' },
      })
    })

    it('invites a friend with invitee_id and detail', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await inviteDeviceFriend(9, 55, '加个好友吧')

      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/friend-invite', {
        body: { user_id: 9, invitee_id: 55, detail: '加个好友吧' },
      })
    })

    it('removes a friend by friend_id', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await removeDeviceFriend(9, 55)

      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/friend-delete', {
        body: { user_id: 9, friend_id: 55 },
      })
    })

    it('changes the remark of a friend', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await updateFriendRemark(9, 55, '小明明')

      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/friend-change-remark', {
        body: { user_id: 9, friend_id: 55, remark: '小明明' },
      })
    })
  })

  describe('emergency contacts', () => {
    it('maps contact types and the SOS quota', async () => {
      weilaFetch.mockResolvedValue(
        ok({
          contacts: [
            { id: 0, name: '爸爸', number: '13800000000', type: 1 },
            { id: 55, name: '小明', number: '6002', type: 2, avatar: 'http://cdn/m.png' },
          ],
          sos_friend_limit: 5,
          sos_phone_limit: 3,
          sos_times: 2,
        }),
      )

      await expect(getEmergencyContacts(9)).resolves.toEqual({
        contacts: [
          { type: 'phone', userId: 0, name: '爸爸', number: '13800000000', avatar: '' },
          { type: 'friend', userId: 55, name: '小明', number: '6002', avatar: 'http://cdn/m.png' },
        ],
        quota: { friendMax: 5, phoneMax: 3, sosRemaining: 2 },
      })
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/emergency-contact-get', {
        body: { user_id: 9 },
      })
    })

    it('adds a phone contact by name and number', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await addEmergencyPhoneContact(9, '爸爸', '13800000000')

      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/emergency-contact-add-phone', {
        body: { user_id: 9, name: '爸爸', number: '13800000000' },
      })
    })

    it('adds a friend contact by friend_id', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await addEmergencyFriendContact(9, 55)

      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/emergency-contact-add-friend', {
        body: { user_id: 9, friend_id: 55 },
      })
    })

    it('deletes contacts by number plus the numeric type', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await removeEmergencyContact(9, '13800000000', 'phone')
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/emergency-contact-delete', {
        body: { user_id: 9, number: '13800000000', type: 1 },
      })

      weilaFetch.mockClear()
      await removeEmergencyContact(9, '6002', 'friend')
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/emergency-contact-delete', {
        body: { user_id: 9, number: '6002', type: 2 },
      })
    })
  })

  describe('sim renewal', () => {
    it('lists the SIM cards that are due for renewal', async () => {
      weilaFetch.mockResolvedValue(
        ok({
          renews: [
            {
              iccid: '8986',
              expiry_date: '2027-11-30',
              product: 'CF03',
              imei: '866',
              user_num: '3001',
              user_nick: 'watch',
            },
          ],
        }),
      )

      await expect(getRenewSimCards()).resolves.toEqual([
        {
          iccid: '8986',
          expiryDate: '2027-11-30',
          product: 'CF03',
          imei: '866',
          userNum: '3001',
          userNick: 'watch',
        },
      ])
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/simcard-get-all-need-renew')
    })

    it('creates a renewal order and maps the result', async () => {
      weilaFetch.mockResolvedValue(
        ok({
          amount: 2900,
          currency: 'CNY',
          order_no: 'RN20260211',
          product_id: 'pkg_year',
          product_name: '年卡',
          product_desc: '语音年卡',
        }),
      )

      await expect(
        createRenewOrder({ iccid: '8986', payMethod: 'wechat', pkgName: 'com.voistech.weila' }),
      ).resolves.toEqual({
        orderNo: 'RN20260211',
        amount: 2900,
        currency: 'CNY',
        productId: 'pkg_year',
        productName: '年卡',
        productDesc: '语音年卡',
      })
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/simcard-create-renew-order', {
        body: { iccid: '8986', pay_method: 'wechat', pkg_name: 'com.voistech.weila' },
      })
    })

    it('lists renewal orders keeping fen amounts and numeric statuses', async () => {
      weilaFetch.mockResolvedValue(
        ok({
          orders: [
            {
              amount: 2900,
              status: 2,
              charge_status: 1,
              order_no: 'RN20260211',
              order_desc: '语音年卡',
              iccid: '8986',
              created: '2026-02-11 10:00:00',
            },
          ],
        }),
      )

      await expect(getRenewOrderRecords()).resolves.toEqual([
        {
          orderNo: 'RN20260211',
          amount: 2900,
          status: 2,
          chargeStatus: 1,
          orderDesc: '语音年卡',
          iccid: '8986',
          createdAt: '2026-02-11 10:00:00',
        },
      ])
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/simcard-get-all-renew-order')
    })
  })

  describe('groups', () => {
    const groupDto = {
      group_id: 42,
      num: 'G100',
      name: '家人',
      avatar: 'http://cdn/g.png',
      is_creator: true,
      is_admin: false,
      is_audit: true,
    }

    it('lists the groups a device joined', async () => {
      weilaFetch.mockResolvedValue(ok({ groups: [groupDto] }))

      await expect(getDeviceGroups(9)).resolves.toEqual([
        {
          groupId: 42,
          num: 'G100',
          name: '家人',
          avatar: 'http://cdn/g.png',
          isCreator: true,
          isAdmin: false,
          isAudit: true,
        },
      ])
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-get-all', { body: { user_id: 9 } })
    })

    it('maps the member remark onto the nickname, trimming a cleared name', async () => {
      weilaFetch.mockResolvedValue(
        ok({
          members: [
            {
              user_id: 9,
              user_num: '3001',
              nick: 'watch',
              avatar: '',
              remark: '我的名片',
              is_admin: true,
            },
            { user_id: 77, user_num: '6002', nick: '小明', avatar: '', remark: '  ' },
          ],
        }),
      )

      await expect(getGroupMembers(9, 42)).resolves.toEqual([
        {
          userId: 9,
          userNum: '3001',
          nick: 'watch',
          avatar: '',
          isAdmin: true,
          nickname: '我的名片',
        },
        { userId: 77, userNum: '6002', nick: '小明', avatar: '', isAdmin: false, nickname: '' },
      ])
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-member-get-all', {
        body: { user_id: 9, group_id: 42 },
      })
    })

    it('assembles the group overview from list plus members', async () => {
      weilaFetch.mockImplementation((url: string) => {
        if (url === '/v2/subuser/group-get-all') {
          return Promise.resolve(ok({ groups: [groupDto] }))
        }
        return Promise.resolve(
          ok({
            members: [
              { user_id: 9, user_num: '3001', nick: 'watch', avatar: '', remark: '我的名片' },
              { user_id: 77, user_num: '6002', nick: '小明', avatar: '', remark: '小明' },
            ],
          }),
        )
      })

      await expect(getGroupOverview(9, 42)).resolves.toEqual({
        groupId: 42,
        num: 'G100',
        name: '家人',
        avatar: 'http://cdn/g.png',
        isCreator: true,
        isAdmin: false,
        isAudit: true,
        intro: '',
        createdAt: '',
        memberCount: 2,
        settings: { muted: false, shareLocation: false, broadcast: false, pinned: false },
        myNickname: '我的名片',
      })
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-get-all', { body: { user_id: 9 } })
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-member-get-all', {
        body: { user_id: 9, group_id: 42 },
      })
    })

    it('rejects the overview when the group is not in the list', async () => {
      weilaFetch.mockImplementation((url: string) => {
        if (url === '/v2/subuser/group-get-all') {
          return Promise.resolve(ok({ groups: [] }))
        }
        return Promise.resolve(ok({ members: [] }))
      })

      await expect(getGroupOverview(9, 42)).rejects.toThrow('group not found')
    })

    it('joins a group with group_id and detail', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await expect(joinDeviceGroup(9, 42, '申请加入')).resolves.toEqual({})
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-join', {
        body: { user_id: 9, group_id: 42, detail: '申请加入' },
      })
    })

    it('leaves a group by group_id', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await expect(leaveDeviceGroup(9, 42)).resolves.toEqual({})
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-exit', {
        body: { user_id: 9, group_id: 42 },
      })
    })

    it('lists the groups the account manages', async () => {
      weilaFetch.mockResolvedValue(ok({ groups: [groupDto] }))

      await expect(getManagerGroups()).resolves.toEqual([
        {
          groupId: 42,
          num: 'G100',
          name: '家人',
          avatar: 'http://cdn/g.png',
          isCreator: true,
          isAdmin: false,
          isAudit: true,
        },
      ])
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/manager-get-all-group')
    })

    it('searches groups by the key field', async () => {
      weilaFetch.mockResolvedValue(ok({ groups: [groupDto] }))

      await expect(searchGroups(9, '家人')).resolves.toEqual([
        {
          groupId: 42,
          num: 'G100',
          name: '家人',
          avatar: 'http://cdn/g.png',
          isCreator: true,
          isAdmin: false,
          isAudit: true,
        },
      ])
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-search', {
        body: { user_id: 9, key: '家人' },
      })
    })

    it('invites members through member_ids', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await expect(addGroupMembers(9, 42, [55, 56])).resolves.toEqual({})
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-member-invite', {
        body: { user_id: 9, group_id: 42, member_ids: [55, 56] },
      })
    })

    it('removes one member by wrapping the id in member_ids', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await expect(removeGroupMember(9, 42, 55)).resolves.toEqual({})
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-member-delete', {
        body: { user_id: 9, group_id: 42, member_ids: [55] },
      })
    })

    it('renames the group', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await expect(updateGroupName(9, 42, '亲人')).resolves.toEqual({})
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-change-name', {
        body: { user_id: 9, group_id: 42, name: '亲人' },
      })
    })

    it('updates the group avatar', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await expect(updateGroupAvatar(9, 42, 'http://cdn/g2.png')).resolves.toEqual({})
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-change-avatar', {
        body: { user_id: 9, group_id: 42, avatar: 'http://cdn/g2.png' },
      })
    })

    it('transfers ownership with owner_id', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await expect(transferGroupOwner(9, 42, 55)).resolves.toEqual({})
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-change-owner', {
        body: { user_id: 9, group_id: 42, owner_id: 55 },
      })
    })

    it('updates my in-group card name through remark', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await expect(updateMyGroupNickname(9, 42, '我的名片')).resolves.toEqual({})
      expect(weilaFetch).toHaveBeenCalledWith('/v2/subuser/group-member-change-remark', {
        body: { user_id: 9, group_id: 42, remark: '我的名片' },
      })
    })
  })

  describe('reminders', () => {
    it('reads the stored reminder back into the UI model', async () => {
      weilaFetch.mockResolvedValue(ok({ reminders: [apiReminder] }))

      await expect(getDeviceReminders(1848581)).resolves.toEqual([
        {
          reminderId: 116,
          time: '09:30',
          content: '吃药',
          repeat: 'weekdays',
          repeatDays: [1, 2, 3, 4, 5],
          ringDuration: 60,
          repeatCount: 3,
          repeatInterval: 5,
        },
      ])
      expect(weilaFetch).toHaveBeenCalledWith('/v2/ext/rmdr/get-all-reminder', {
        body: { user_id: 1848581 },
      })
    })

    it('derives the repeat from the day set when the response omits the type', async () => {
      weilaFetch.mockResolvedValue(
        ok({
          reminders: [
            { ...apiReminder, repeated_type: undefined, repeated: [] },
            { ...apiReminder, repeated_type: undefined, repeated: [1, 2, 3, 4, 5, 6, 7] },
            { ...apiReminder, repeated_type: undefined, repeated: [1, 2, 3, 4, 5] },
          ],
        }),
      )

      const reminders = await getDeviceReminders(1848581)
      expect(reminders.map((item) => item.repeat)).toEqual(['once', 'daily', 'weekdays'])
    })

    it('keeps a monthly rule instead of folding it into weekdays', async () => {
      weilaFetch.mockResolvedValue(
        ok({ reminders: [{ ...apiReminder, repeated_type: 3, repeated: [15] }] }),
      )

      const reminders = await getDeviceReminders(1848581)
      expect(reminders.map((item) => [item.repeat, item.repeatDays])).toEqual([['monthly', [15]]])
    })

    it('treats a weekly rule outside Monday-Friday as custom', async () => {
      weilaFetch.mockResolvedValue(
        ok({ reminders: [{ ...apiReminder, repeated_type: 2, repeated: [6, 7] }] }),
      )

      const reminders = await getDeviceReminders(1848581)
      expect(reminders.map((item) => [item.repeat, item.repeatDays])).toEqual([['custom', [6, 7]]])
    })

    it('sends a custom weekly rule with its own day set', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await updateDeviceReminder(1848581, 116, {
        time: '09:30',
        content: '吃药',
        repeat: 'custom',
        repeatDays: [6, 7],
        ringDuration: 60,
        repeatCount: 3,
        repeatInterval: 5,
      })

      expect(weilaFetch).toHaveBeenCalledWith('/v2/ext/rmdr/change-reminder', {
        body: {
          id: 116,
          user_id: 1848581,
          name: '吃药',
          reminder: '09:30',
          repeated_type: 2,
          repeated: [6, 7],
          duration: 60,
          again_times: 3,
          again_interval: 300,
        },
      })
    })

    it('writes the repeat type, day set and seconds the API expects', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await createDeviceReminder(1848581, {
        time: '08:00',
        content: '起床',
        repeat: 'daily',
        ringDuration: 30,
        repeatCount: 5,
        repeatInterval: 2,
      })

      expect(weilaFetch).toHaveBeenCalledWith('/v2/ext/rmdr/add-reminder', {
        body: {
          user_id: 1848581,
          name: '起床',
          reminder: '08:00',
          repeated_type: 1,
          repeated: [1, 2, 3, 4, 5, 6, 7],
          duration: 30,
          again_times: 5,
          again_interval: 120,
        },
      })
    })

    it('identifies the reminder when editing', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await updateDeviceReminder(1848581, 116, {
        time: '09:30',
        content: '吃药',
        repeat: 'once',
        ringDuration: 600,
        repeatCount: 0,
        repeatInterval: 1,
      })

      expect(weilaFetch).toHaveBeenCalledWith('/v2/ext/rmdr/change-reminder', {
        body: {
          id: 116,
          user_id: 1848581,
          name: '吃药',
          reminder: '09:30',
          repeated_type: 0,
          repeated: [],
          duration: 600,
          again_times: 0,
          again_interval: 60,
        },
      })
    })

    it('deletes the reminder by wrapping the id in reminder_ids', async () => {
      weilaFetch.mockResolvedValue(ok({}))

      await removeDeviceReminder(1848581, 116)

      expect(weilaFetch).toHaveBeenCalledWith('/v2/ext/rmdr/delete-reminder', {
        body: { user_id: 1848581, reminder_ids: [116] },
      })
    })
  })
})
