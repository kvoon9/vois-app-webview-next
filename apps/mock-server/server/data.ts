export type GroupMemberRole = 'owner' | 'admin' | 'member'

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
}

export interface Group {
  group_id: number
  num: string
  name: string
  avatar: string
  intro: string
  created_at: string
  created_by: number
}

export interface User {
  user_id: number
  user_num: string
  nick: string
  avatar: string
  online: boolean
  signature: string
}

export interface Membership {
  user_id: number
  role: GroupMemberRole
}

const avatar = (id: number) => `https://api.dicebear.com/9.x/initials/svg?seed=${id}`

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
  },
  {
    group_id: 1002,
    num: '7001002',
    name: 'test',
    avatar: avatar(1002),
    intro: '测试群组',
    created_at: '2024-07-01 08:00:00',
    created_by: 1,
  },
  {
    group_id: 1003,
    num: '7001003',
    name: '茶花区',
    avatar: avatar(1003),
    intro: '茶花爱好者的交流区。',
    created_at: '2023-12-20 16:45:00',
    created_by: 1,
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
  },
  {
    user_id: 2,
    user_num: '10000002',
    nick: '周宁',
    avatar: avatar(2),
    online: true,
    signature: '今天也要开心。',
  },
  {
    user_id: 3,
    user_num: '10000003',
    nick: '陈默',
    avatar: avatar(3),
    online: false,
    signature: '向前看。',
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
    }
  }),
  {
    user_id: 101,
    user_num: 'V1010001',
    nick: '工作手机',
    avatar: avatar(101),
    online: true,
    signature: '工作设备',
  },
  {
    user_id: 102,
    user_num: 'V1020002',
    nick: '备用手机',
    avatar: avatar(102),
    online: false,
    signature: '备用设备',
  },
]

export const memberships = new Map<number, Membership[]>([
  [
    1001,
    [
      { user_id: 1, role: 'owner' },
      { user_id: 2, role: 'admin' },
      { user_id: 2001, role: 'member' },
      { user_id: 2002, role: 'member' },
      { user_id: 2003, role: 'member' },
      { user_id: 2004, role: 'member' },
      { user_id: 2005, role: 'member' },
      { user_id: 2006, role: 'member' },
    ],
  ],
  [
    1002,
    [
      { user_id: 2, role: 'owner' },
      { user_id: 3, role: 'admin' },
      { user_id: 2007, role: 'member' },
      { user_id: 2008, role: 'member' },
    ],
  ],
  [
    1003,
    [
      { user_id: 1, role: 'owner' },
      { user_id: 3, role: 'admin' },
      { user_id: 2009, role: 'member' },
      { user_id: 2010, role: 'member' },
      { user_id: 101, role: 'member' },
    ],
  ],
])

export const deviceGroups = new Map<number, number[]>([
  [101, [1001, 1003]],
  [102, [1002]],
])

export const friends = users.filter((user) => user.user_id >= 2001 && user.user_id <= 2010)

export const meId = 1
