import {
  asJsonObject,
  readBoolean,
  readNumber,
  readString,
  readValue,
  type DebugEvent,
  type JsonObject,
} from '../../../../packages/mcp/src/index.ts'

/** The fields of one manager-get-all-device row a list proof asserts. */
export interface DeviceRow {
  userId?: number
  nick?: string
  product?: string
  battery?: number
}

/** The device-get-detail fields the detail screen renders. */
export interface DeviceDetail {
  nick?: string
  product?: string
  imei?: string
  userNum?: string
  sdkVersion?: string
  activeAt?: string
  locationSupport?: boolean
  reminderSupport?: boolean
  emergencySupport?: boolean
  hasSimCard: boolean
  canRecharge: boolean
  cardRecharge: boolean
  iccid?: string
  expiryDate?: string
}

/** The parsed body of a captured /v2 reply, or a failure naming the call. */
export function capturedBody(call: DebugEvent, label: string): JsonObject {
  const body = asJsonObject(call.responseBody)
  if (body === undefined) throw new Error(`${label} response body is not a JSON object`)
  return body
}

export function readDevices(body: JsonObject): DeviceRow[] {
  const data = asJsonObject(readValue(body, 'data'))
  if (data === undefined) throw new Error('manager-get-all-device data is not an object')
  const devices = readValue(data, 'devices')
  if (!Array.isArray(devices)) {
    throw new Error('manager-get-all-device data.devices is not an array')
  }
  return devices.flatMap((item) => {
    const device = asJsonObject(item)
    if (device === undefined) return []
    return [
      {
        userId: readNumber(device, 'user_id'),
        nick: readString(device, 'nick'),
        product: readString(device, 'product'),
        battery: readNumber(device, 'battery'),
      },
    ]
  })
}

export function readDeviceDetail(body: JsonObject): DeviceDetail {
  const data = asJsonObject(readValue(body, 'data'))
  const device = asJsonObject(readValue(data ?? {}, 'device'))
  if (device === undefined) throw new Error('device-get-detail data.device is not an object')
  const sim = asJsonObject(readValue(device, 'sim_card'))
  const iccid = sim === undefined ? undefined : readString(sim, 'iccid')
  return {
    nick: readString(device, 'nick'),
    product: readString(device, 'product'),
    imei: readString(device, 'imei'),
    userNum: readString(device, 'user_num'),
    // The detail screen renders the short SDK version, falling back to the firmware string.
    sdkVersion: readString(device, 'sdk_version') ?? readString(device, 'version'),
    activeAt: readString(device, 'active_at'),
    locationSupport: readBoolean(device, 'location_support'),
    reminderSupport: readBoolean(device, 'reminder_support'),
    emergencySupport: readBoolean(device, 'emergency_support'),
    hasSimCard: sim !== undefined,
    // The recharge action needs an ICCID; the SIM rows only need the card object.
    canRecharge: iccid !== undefined && iccid !== '',
    cardRecharge: sim === undefined ? false : readBoolean(sim, 'recharge') === true,
    iccid,
    expiryDate: sim === undefined ? undefined : readString(sim, 'expiry_date'),
  }
}
