export type GroupMemberRole = 'owner' | 'admin' | 'member'
export type TrackFrequency = 'off' | 'low' | 'mid' | 'high'

export interface GroupSettings {
  muted: boolean
  share_location: boolean
  broadcast: boolean
  pinned: boolean
}

export interface ContactSettings {
  muted: boolean
  share_location: boolean
  broadcast: boolean
  pinned: boolean
}

export interface Device {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  product: string
  imei: string
  version: string
  activated_at: string
  online: boolean
  share_location: boolean
}

export interface Group {
  group_id: number
  num: string
  name: string
  avatar: string
  intro: string
  created_at: string
  created_by: number
  settings: GroupSettings
}

export interface User {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  online: boolean
  signature: string
  registered_at: string
}

export interface Membership {
  user_id: number
  role: GroupMemberRole
  nickname: string
}

export interface DeviceLocation {
  lng: number
  lat: number
  updated_at: string
  report_frequency: TrackFrequency
  fence: {
    lng: number
    lat: number
    radius: number
  } | null
}

export interface TrackPoint {
  lng: number
  lat: number
  time: string
}

export interface DeviceContact {
  user_id: number
  registered_at: string
  settings: ContactSettings
  remark: string
}

export interface RechargeInfo {
  user_id: number
  iccid: string
  expire_at: string
  price: number
}

export interface RechargeOrder {
  order_id: number
  device_count: number
  total_price: number
}

export interface RechargeRecord {
  order_id: number
  amount: number
  status: string
  created_at: string
}

export type EmergencyContactType = 'friend' | 'phone'

export interface EmergencyContact {
  contact_id: number
  type: EmergencyContactType
  /** friend contacts point at a seeded user; phone contacts store raw fields */
  user_id?: number
  name: string
  phone: string
}

export interface EmergencyQuota {
  friend_max: number
  phone_max: number
  sos_remaining: number
}

export type ReminderRepeat = 'once' | 'daily' | 'weekdays'

export interface Reminder {
  reminder_id: number
  time: string
  content: string
  repeat: ReminderRepeat
  ring_duration: number
  repeat_count: number
  repeat_interval: number
}

const avatar = (id: number) => `https://api.dicebear.com/9.x/initials/svg?seed=${id}`
const defaultSettings = (): GroupSettings => ({
  muted: false,
  share_location: false,
  broadcast: false,
  pinned: false,
})
const defaultContactSettings = (): ContactSettings => ({
  muted: false,
  share_location: false,
  broadcast: false,
  pinned: false,
})

export const meId = 1

export const devices: Device[] = [
  {
    user_id: 101,
    user_num: 'V1010001',
    nick: '工作手机',
    avatar: avatar(101),
    product: 'VoiS Pro 5',
    imei: '867530900001001',
    version: '3.6.1',
    activated_at: '2025-01-18 09:30:00',
    online: true,
    share_location: true,
  },
  {
    user_id: 102,
    user_num: 'V1020002',
    nick: '备用手机',
    avatar: avatar(102),
    product: 'VoiS Mini',
    imei: '867530900001002',
    version: '3.5.8',
    activated_at: '2024-11-06 14:10:00',
    online: false,
    share_location: false,
  },
]

export const groups: Group[] = [
  {
    group_id: 1001,
    num: '7001001',
    name: 'G1',
    avatar: avatar(1001),
    intro: '一起交流和分享生活。',
    created_at: '2024-03-12 10:20:00',
    created_by: 1,
    settings: defaultSettings(),
  },
  {
    group_id: 1002,
    num: '7001002',
    name: 'test',
    avatar: avatar(1002),
    intro: '测试群组',
    created_at: '2024-07-01 08:00:00',
    created_by: 2,
    settings: defaultSettings(),
  },
  {
    group_id: 1003,
    num: '7001003',
    name: '茶花区',
    avatar: avatar(1003),
    intro: '茶花爱好者的交流区。',
    created_at: '2023-12-20 16:45:00',
    created_by: 1,
    settings: defaultSettings(),
  },
]

export const users: User[] = [
  {
    user_id: 1,
    user_num: '10000001',
    nick: '林舟',
    avatar: avatar(1),
    online: true,
    signature: '保持热爱，奔赴山海。',
    registered_at: '2023-06-01 09:00:00',
  },
  {
    user_id: 2,
    user_num: '10000002',
    nick: '周宁',
    avatar: avatar(2),
    online: true,
    signature: '今天也要开心。',
    registered_at: '2023-06-08 10:30:00',
  },
  {
    user_id: 3,
    user_num: '10000003',
    nick: '陈默',
    avatar: avatar(3),
    online: false,
    signature: '向前看。',
    registered_at: '2023-07-12 14:20:00',
  },
  ...Array.from({ length: 10 }, (_, index) => {
    const userId = 2001 + index
    return {
      user_id: userId,
      user_num: `2000${String(index + 1).padStart(3, '0')}`,
      nick: ['小满', '阿南', '清风', '夏至', '小雅', '木子', '星河', '安然', '阿青', '远山'][index],
      avatar: avatar(userId),
      online: index % 3 !== 1,
      signature: ['正在输入中', '有空一起聊天', '记录美好生活'][index % 3],
      registered_at: `2024-02-${String(index + 1).padStart(2, '0')} 08:00:00`,
    }
  }),
  {
    user_id: 101,
    user_num: 'V1010001',
    nick: '工作手机',
    avatar: avatar(101),
    online: true,
    signature: '工作设备',
    registered_at: '2024-01-18 09:30:00',
  },
  {
    user_id: 102,
    user_num: 'V1020002',
    nick: '备用手机',
    avatar: avatar(102),
    online: false,
    signature: '备用设备',
    registered_at: '2024-01-18 09:35:00',
  },
]

export const memberships = new Map<number, Membership[]>([
  [
    1001,
    [
      { user_id: 1, role: 'owner', nickname: '林舟' },
      { user_id: 2, role: 'admin', nickname: '周宁' },
      { user_id: 2001, role: 'member', nickname: '小满' },
      { user_id: 2002, role: 'member', nickname: '' },
      { user_id: 2003, role: 'member', nickname: '清风' },
      { user_id: 2004, role: 'member', nickname: '' },
      { user_id: 2005, role: 'member', nickname: '' },
      { user_id: 2006, role: 'member', nickname: '夏至' },
      { user_id: 101, role: 'member', nickname: '工作手机' },
    ],
  ],
  [
    1002,
    [
      { user_id: 2, role: 'owner', nickname: '周宁' },
      { user_id: 3, role: 'admin', nickname: '陈默' },
      { user_id: 1, role: 'member', nickname: '小舟' },
      { user_id: 102, role: 'member', nickname: '备用手机' },
      { user_id: 2007, role: 'member', nickname: '' },
      { user_id: 2008, role: 'member', nickname: '安然' },
    ],
  ],
  [
    1003,
    [
      { user_id: 1, role: 'owner', nickname: '林舟' },
      { user_id: 3, role: 'admin', nickname: '陈默' },
      { user_id: 101, role: 'member', nickname: '工作手机' },
      { user_id: 2009, role: 'member', nickname: '星河' },
      { user_id: 2010, role: 'member', nickname: '' },
    ],
  ],
])

export const deviceGroups = new Map<number, number[]>([
  [101, [1001, 1003]],
  [102, [1002]],
])

export const deviceContacts = new Map<number, DeviceContact[]>([
  [
    101,
    [
      {
        user_id: 2001,
        registered_at: '2024-02-01 08:00:00',
        settings: defaultContactSettings(),
        remark: '',
      },
      {
        user_id: 2002,
        registered_at: '2024-02-02 08:00:00',
        settings: { ...defaultContactSettings(), pinned: true },
        remark: '同事',
      },
    ],
  ],
  [
    102,
    [
      {
        user_id: 2003,
        registered_at: '2024-02-03 08:00:00',
        settings: defaultContactSettings(),
        remark: '',
      },
    ],
  ],
])

export const rechargeInfo: RechargeInfo[] = [
  {
    user_id: 101,
    iccid: '8986001234567890001',
    expire_at: '2026-12-31 23:59:59',
    price: 30,
  },
  {
    user_id: 102,
    iccid: '8986001234567890002',
    expire_at: '2026-08-31 23:59:59',
    price: 20,
  },
]

export const rechargeOrders: RechargeOrder[] = []
export const rechargeRecords = new Map<number, RechargeRecord[]>([
  [
    101,
    [
      { order_id: 8001, amount: 30, status: '已完成', created_at: '2026-08-18 14:38:01' },
      { order_id: 8002, amount: 30, status: '已完成', created_at: '2026-05-18 10:12:20' },
    ],
  ],
  [
    102,
    [
      { order_id: 8011, amount: 20, status: '已完成', created_at: '2026-07-01 09:08:12' },
      { order_id: 8012, amount: 20, status: '处理中', created_at: '2026-04-01 11:25:33' },
      { order_id: 8013, amount: 20, status: '已完成', created_at: '2026-01-01 08:01:05' },
    ],
  ],
])

export const deviceLocations = new Map<number, DeviceLocation>([
  [
    101,
    {
      lng: 114.0684,
      lat: 22.6295,
      updated_at: '2026-09-04 10:28:00',
      report_frequency: 'off',
      fence: { lng: 114.0668, lat: 22.6305, radius: 980 },
    },
  ],
  [
    102,
    {
      lng: 114.0557,
      lat: 22.6172,
      updated_at: '2026-09-03 18:06:00',
      report_frequency: 'low',
      fence: null,
    },
  ],
])

export const deviceTracks = new Map<number, Map<string, TrackPoint[]>>([
  [
    101,
    new Map([
      [
        '2026-09-02',
        [
          { lng: 114.0612, lat: 22.6344, time: '08:12:00' },
          { lng: 114.0638, lat: 22.6322, time: '09:04:00' },
          { lng: 114.0671, lat: 22.6334, time: '10:16:00' },
          { lng: 114.0702, lat: 22.6308, time: '11:28:00' },
          { lng: 114.0684, lat: 22.6279, time: '13:45:00' },
        ],
      ],
      [
        '2026-09-03',
        [
          { lng: 114.0712, lat: 22.6264, time: '07:58:00' },
          { lng: 114.0685, lat: 22.6284, time: '08:42:00' },
          { lng: 114.0653, lat: 22.6272, time: '10:18:00' },
          { lng: 114.0627, lat: 22.6299, time: '12:06:00' },
          { lng: 114.0649, lat: 22.6321, time: '15:22:00' },
          { lng: 114.0688, lat: 22.6302, time: '17:10:00' },
        ],
      ],
      [
        '2026-09-04',
        [
          { lng: 114.0631, lat: 22.6258, time: '08:06:00' },
          { lng: 114.0646, lat: 22.6282, time: '08:54:00' },
          { lng: 114.0678, lat: 22.6297, time: '09:32:00' },
          { lng: 114.0708, lat: 22.6286, time: '10:04:00' },
          { lng: 114.0684, lat: 22.6295, time: '10:28:00' },
        ],
      ],
    ]),
  ],
  [102, new Map()],
])
let nextRechargeOrderId = 9001

export function createRechargeOrder(deviceIds: number[]): RechargeOrder {
  const selected = rechargeInfo.filter((item) => deviceIds.includes(item.user_id))
  const order: RechargeOrder = {
    order_id: nextRechargeOrderId++,
    device_count: selected.length,
    total_price: Math.round(selected.reduce((total, item) => total + item.price, 0) * 100) / 100,
  }
  rechargeOrders.push(order)
  return order
}

export const friends = users.filter((user) => user.user_id >= 2001 && user.user_id <= 2010)

export const emergencyQuota: EmergencyQuota = {
  friend_max: 3,
  phone_max: 2,
  sos_remaining: 5,
}

// Seeded rows consume 5001; allocation continues after it.
let nextEmergencyContactId = 5002

export function allocateEmergencyContactId(): number {
  return nextEmergencyContactId++
}

export const deviceEmergencyContacts = new Map<number, EmergencyContact[]>([
  [101, [{ contact_id: 5001, type: 'friend', user_id: 2001, name: '小满', phone: '13800002001' }]],
])

// Seeded rows consume 6001; allocation continues after it.
let nextReminderId = 6002

export function allocateReminderId(): number {
  return nextReminderId++
}

export const deviceReminders = new Map<number, Reminder[]>([
  [
    101,
    [
      {
        reminder_id: 6001,
        time: '17:32',
        content: '123',
        repeat: 'once',
        ring_duration: 30,
        repeat_count: 3,
        repeat_interval: 5,
      },
    ],
  ],
])
