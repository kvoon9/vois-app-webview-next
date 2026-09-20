import { weilaFetch } from '~/utils/api'

/**
 * Activation states the backend reports. `0` is an unactivated code, `1` an
 * activated one; anything else is a backend state this page cannot render.
 */
export const BLUETOOTH_UNACTIVATED = 0
export const BLUETOOTH_ACTIVATED = 1

/** The account a code is bound to once activated. */
export interface BluetoothActiveUser {
  userId: number
  number: string
  nick: string
  avatar: string
  expiryDate: string
}

/** Everything the activation page renders about one code. */
export interface BluetoothCodeInfo {
  name: string
  uuid: string
  status: number
  validityPeriod: string
  activeBefore: string
  /** Absent until the code is activated, so it must be read as nullable. */
  activeUser: BluetoothActiveUser | null
}

/** The signed-in account, shown in the confirmation dialog before binding. */
export interface BluetoothOwnAccount {
  num: string
  nick: string
}

interface CodeInfoDto {
  name: string
  uuid: string
  status: number
  validity_period: string
  active_before: string
  active_user?: {
    user_id: number
    number: string
    nick: string
    avatar: string
    expiry_date: string
  }
}

interface OwnAccountDto {
  user: {
    id: number
    num: string
    nick: string
  }
}

function toCodeInfo(dto: CodeInfoDto): BluetoothCodeInfo {
  return {
    name: dto.name,
    uuid: dto.uuid,
    status: dto.status,
    validityPeriod: dto.validity_period,
    activeBefore: dto.active_before,
    activeUser: dto.active_user
      ? {
          userId: dto.active_user.user_id,
          number: dto.active_user.number,
          nick: dto.active_user.nick,
          avatar: dto.active_user.avatar,
          expiryDate: dto.active_user.expiry_date,
        }
      : null,
  }
}

/**
 * The backend spells a duration as `<count><unit>`, e.g. `12month`, and never
 * localizes it. Anything outside that shape is not a duration this page can
 * render, so callers fall back to the raw string.
 */
export function parseValidityPeriod(value: string): { count: number; unit: string } | null {
  const parts = /^(\d+)([a-z]+)$/.exec(value)
  return parts ? { count: Number(parts[1]), unit: parts[2] } : null
}

/** Read one code's info, as the page's initial state. */
export async function getBluetoothCodeInfo(uuid: string): Promise<BluetoothCodeInfo> {
  const response = await weilaFetch<{ info: CodeInfoDto }>('/v2/account/bluetooth/get-uuid-info', {
    body: { uuid },
  })
  return toCodeInfo(response.data.info)
}

/**
 * Activate one code and return the resulting state.
 *
 * The write answers with an empty envelope (`{ errcode: 0, errmsg: "请求成功" }`,
 * no `data`), unlike the read. Asking the write for the info crashes on
 * `response.data.info`, so the activated info is read back instead.
 */
export async function activateBluetoothCode(uuid: string): Promise<BluetoothCodeInfo> {
  await weilaFetch<unknown>('/v2/qrcode/bluetooth-ai-translate-active', { body: { uuid } })
  return getBluetoothCodeInfo(uuid)
}

/** The account the code would be bound to, shown in the confirmation dialog. */
export async function getOwnAccount(): Promise<BluetoothOwnAccount> {
  const response = await weilaFetch<OwnAccountDto>('/v2/user/get-my-user-info')
  return { num: response.data.user.num, nick: response.data.user.nick }
}
