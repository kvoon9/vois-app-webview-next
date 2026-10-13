import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  createDeviceReminder,
  getConnectedDevices,
  getDeviceReminders,
  updateDeviceReminder,
} from './device-api'

const weilaFetch = vi.hoisted(() => vi.fn())

vi.mock('~/utils/api', () => ({ weilaFetch }))

/** One reminder exactly as `/v2/ext/rmdr` stores it. */
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

  it('maps the SIM card a manager device may carry', async () => {
    weilaFetch.mockResolvedValue({
      data: {
        devices: [
          {
            user_id: 1,
            user_num: '3001',
            nick: 'watch',
            avatar: '',
            product: 'CF03',
            imei: '866',
            version: 'v1.110',
            active_at: '2026-08-28',
            online: true,
            location_share: true,
            sim_card: { iccid: '8986', expiry_date: '2027-11-30', recharge: true },
          },
          {
            user_id: 2,
            user_num: '3002',
            nick: 'phone',
            avatar: '',
            product: 'OP02',
            imei: '861',
            version: 'v2',
            active_at: '2026-08-18',
            online: false,
            location_share: false,
          },
        ],
      },
    })

    await expect(getConnectedDevices()).resolves.toMatchObject([
      { userId: 1, simCard: { iccid: '8986', expiryDate: '2027-11-30', recharge: true } },
      { userId: 2, simCard: null },
    ])
  })

  it('reads the stored repeat days and seconds back into the UI model', async () => {
    weilaFetch.mockResolvedValue({ data: { reminders: [apiReminder] } })

    await expect(getDeviceReminders(1848581)).resolves.toEqual([
      {
        reminderId: 116,
        time: '09:30',
        content: '吃药',
        repeat: 'weekdays',
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
    weilaFetch.mockResolvedValue({
      data: {
        reminders: [
          { ...apiReminder, repeated_type: undefined, repeated: [] },
          { ...apiReminder, repeated_type: undefined, repeated: [1, 2, 3, 4, 5, 6, 7] },
        ],
      },
    })

    const reminders = await getDeviceReminders(1848581)
    expect(reminders.map((item) => item.repeat)).toEqual(['once', 'daily'])
  })

  it('writes the repeat type, day set and seconds the API expects', async () => {
    weilaFetch.mockResolvedValue({ data: {} })

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
    weilaFetch.mockResolvedValue({ data: {} })

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
})
