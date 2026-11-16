import { Bridge } from '@vois/webview-bridge'
import type { WechatPrepay } from '@vois/webview-bridge/vois'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  fetchPageParams,
  type PageParams,
  type PageParamsBridgeSource,
  type PageParamsErrorReason,
} from '~/composables/usePageParams'
import { createAppBridge } from './client'
import { createNativeClipboard, type ClipboardBridge } from './clipboard-bridge'
import { createWechatPay, type WechatPayOutcome } from './payment-bridge'
import type { BridgeErrorCode } from './types'

/**
 * Protocol x reply shape coverage. Each cell is the outcome the adapter reports.
 *
 * | protocol          | success | native error | unknown action  | invalid JSON    | timeout  | late answer     |
 * | get-page-params   | values  | native 31    | invalid         | invalid         | timeout  | stays timed out |
 * | access-token read | token   | NATIVE_ERROR | BRIDGE_INVALID  | BRIDGE_INVALID  | TIMEOUT  | -               |
 * | write-clipboard   | true    | false        | false           | false           | false    | -               |
 * | wechat-app-prepay | paid    | failed 31    | unsupported     | failed          | timedOut | -               |
 *
 * Additional payment shapes: a success envelope without `wxpaycode` is a failure,
 * and a missing bridge is unsupported.
 */

const TIMEOUT_MS = 100
const CLIPBOARD_TEXT = '861490079048881'
const UNKNOWN_ACTION = JSON.stringify({ success: false, message: 'Unknown action' })

const PREPAY: WechatPrepay = {
  partnerid: '1900000109',
  prepayid: 'wx201410272009395522657a690389285100',
  noncestr: '5K8264ILTKCH16CQ2502SI8ZNMTM67VS',
  timestamp: 1414563803,
  sign: 'C380BEC2BFD727A4B6845133519F3AD6',
}

/** A real bridge that answers every dispatched request with `raw`. */
function answeringBridge(raw: string): Bridge {
  return Bridge.create((_type, _data, onResponse) => onResponse?.(raw))
}

/** A real bridge whose native side throws, so the request rejects. */
function throwingBridge(): Bridge {
  return Bridge.create(() => {
    throw new Error('bridge tore down')
  })
}

/** A real bridge the test answers later; `replies` releases one request at a time. */
function deferredBridge() {
  const replies: Array<(raw: string) => void> = []
  const bridge = Bridge.create((_type, _data, onResponse) => {
    if (onResponse) replies.push(onResponse)
  })
  return { bridge, replies }
}

function okEnvelope(data: PageParams): string {
  return JSON.stringify({ errcode: 0, errmsg: 'ok', data })
}

function tokenEnvelope(token: string): string {
  return JSON.stringify({ errcode: 0, errmsg: 'ok', data: { 'access-token': token } })
}

function pageParamsSource(bridge: Bridge): PageParamsBridgeSource {
  return { supported: () => true, whenReady: async () => bridge }
}

function appBridgeSource(bridge: Bridge) {
  return { supported: () => true, whenReady: async () => bridge, getPage: () => '/qa' }
}

interface PageParamsCase {
  replyKind: string
  outcome: string
  reply: string
  expected: { values: PageParams } | { reason: PageParamsErrorReason; nativeCode?: number }
}

const PAGE_PARAMS_CASES: PageParamsCase[] = [
  {
    replyKind: 'success',
    outcome: 'values',
    reply: okEnvelope({ 'login-id': '441' }),
    expected: { values: { 'login-id': '441' } },
  },
  {
    replyKind: 'native error',
    outcome: 'native 31',
    reply: JSON.stringify({ errcode: 31, errmsg: 'auth expired' }),
    expected: { reason: 'native', nativeCode: 31 },
  },
  {
    replyKind: 'unknown action',
    outcome: 'invalid',
    reply: UNKNOWN_ACTION,
    expected: { reason: 'invalid' },
  },
  {
    replyKind: 'invalid JSON',
    outcome: 'invalid',
    reply: 'not json',
    expected: { reason: 'invalid' },
  },
]

interface AccessTokenCase {
  replyKind: string
  outcome: string
  reply: string
  expected: { token: string } | { code: BridgeErrorCode; nativeCode?: number }
}

const ACCESS_TOKEN_CASES: AccessTokenCase[] = [
  {
    replyKind: 'success',
    outcome: 'token',
    reply: tokenEnvelope('native-token'),
    expected: { token: 'native-token' },
  },
  {
    replyKind: 'native error',
    outcome: 'NATIVE_ERROR',
    reply: JSON.stringify({ errcode: 31, errmsg: 'auth expired' }),
    expected: { code: 'NATIVE_ERROR', nativeCode: 31 },
  },
  {
    replyKind: 'unknown action',
    outcome: 'BRIDGE_INVALID_RESPONSE',
    reply: UNKNOWN_ACTION,
    expected: { code: 'BRIDGE_INVALID_RESPONSE' },
  },
  {
    replyKind: 'invalid JSON',
    outcome: 'BRIDGE_INVALID_RESPONSE',
    reply: 'not json',
    expected: { code: 'BRIDGE_INVALID_RESPONSE' },
  },
]

interface ClipboardCase {
  replyKind: string
  outcome: string
  bridge: Bridge
  expected: boolean
}

const CLIPBOARD_CASES: ClipboardCase[] = [
  {
    replyKind: 'success',
    outcome: 'true',
    bridge: answeringBridge(JSON.stringify({ errcode: 0, errmsg: '' })),
    expected: true,
  },
  {
    replyKind: 'native error',
    outcome: 'false',
    bridge: answeringBridge(JSON.stringify({ errcode: -1, errmsg: 'write failed' })),
    expected: false,
  },
  {
    replyKind: 'unknown action',
    outcome: 'false',
    bridge: answeringBridge(UNKNOWN_ACTION),
    expected: false,
  },
  {
    replyKind: 'invalid JSON',
    outcome: 'false',
    bridge: answeringBridge('not json'),
    expected: false,
  },
  {
    replyKind: 'rejected request',
    outcome: 'false',
    bridge: throwingBridge(),
    expected: false,
  },
]

interface PaymentCase {
  replyKind: string
  outcome: string
  bridge: Bridge
  expected: { kind: WechatPayOutcome['kind']; code?: number }
}

const PAYMENT_CASES: PaymentCase[] = [
  {
    replyKind: 'success',
    outcome: 'paid',
    bridge: answeringBridge(JSON.stringify({ errcode: 0, errmsg: 'ok', data: { wxpaycode: 0 } })),
    expected: { kind: 'paid' },
  },
  {
    replyKind: 'success without wxpaycode',
    outcome: 'failed',
    bridge: answeringBridge(JSON.stringify({ errcode: 0, errmsg: 'ok', data: {} })),
    expected: { kind: 'failed' },
  },
  {
    replyKind: 'wechat rejection',
    outcome: 'failed -2',
    bridge: answeringBridge(JSON.stringify({ errcode: 0, errmsg: 'ok', data: { wxpaycode: -2 } })),
    expected: { kind: 'failed', code: -2 },
  },
  {
    replyKind: 'native error',
    outcome: 'failed 31',
    bridge: answeringBridge(JSON.stringify({ errcode: 31, errmsg: 'payment denied' })),
    expected: { kind: 'failed', code: 31 },
  },
  {
    replyKind: 'unknown action',
    outcome: 'unsupported',
    bridge: answeringBridge(UNKNOWN_ACTION),
    expected: { kind: 'unsupported' },
  },
  {
    replyKind: 'invalid JSON',
    outcome: 'failed',
    bridge: answeringBridge('not json'),
    expected: { kind: 'failed' },
  },
  {
    replyKind: 'rejected request',
    outcome: 'failed',
    bridge: throwingBridge(),
    expected: { kind: 'failed' },
  },
]

afterEach(() => vi.useRealTimers())

describe('get-page-params', () => {
  it.each(PAGE_PARAMS_CASES)('get-page-params / $replyKind -> $outcome', async (row) => {
    const reading = fetchPageParams(
      pageParamsSource(answeringBridge(row.reply)),
      '/qa',
      ['login-id'],
      TIMEOUT_MS,
    )

    if ('values' in row.expected) {
      await expect(reading).resolves.toEqual(row.expected.values)
      return
    }
    await expect(reading).rejects.toMatchObject(row.expected)
  })

  it('get-page-params / timeout -> timeout', async () => {
    vi.useFakeTimers()
    const { bridge } = deferredBridge()
    const reading = fetchPageParams(pageParamsSource(bridge), '/qa', ['login-id'], TIMEOUT_MS)
    const rejection = expect(reading).rejects.toMatchObject({ reason: 'timeout' })

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)
    await rejection
  })

  it('get-page-params / late answer after timeout -> stays timed out', async () => {
    vi.useFakeTimers()
    const { bridge, replies } = deferredBridge()
    const reading = fetchPageParams(pageParamsSource(bridge), '/qa', ['login-id'], TIMEOUT_MS)
    const rejection = expect(reading).rejects.toMatchObject({ reason: 'timeout' })

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)
    await rejection

    replies[0]?.(okEnvelope({ 'login-id': '441' }))
    await vi.advanceTimersByTimeAsync(0)
    await expect(reading).rejects.toMatchObject({ reason: 'timeout' })
  })
})

describe('access-token read', () => {
  it.each(ACCESS_TOKEN_CASES)('access-token read / $replyKind -> $outcome', async (row) => {
    const reading = createAppBridge(appBridgeSource(answeringBridge(row.reply)), TIMEOUT_MS)

    if ('token' in row.expected) {
      await expect(reading.getAccessToken()).resolves.toBe(row.expected.token)
      return
    }
    await expect(reading.getAccessToken()).rejects.toMatchObject(row.expected)
  })

  it('access-token read / timeout -> BRIDGE_TIMEOUT', async () => {
    vi.useFakeTimers()
    const { bridge } = deferredBridge()
    const reading = createAppBridge(appBridgeSource(bridge), TIMEOUT_MS).getAccessToken()
    const rejection = expect(reading).rejects.toMatchObject({ code: 'BRIDGE_TIMEOUT' })

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)
    await rejection
  })
})

describe('write-clipboard', () => {
  it.each(CLIPBOARD_CASES)('write-clipboard / $replyKind -> $outcome', async (row) => {
    const write = createNativeClipboard(
      { supported: () => true, whenReady: async () => row.bridge },
      TIMEOUT_MS,
    )

    await expect(write(CLIPBOARD_TEXT)).resolves.toBe(row.expected)
  })

  it('write-clipboard / timeout -> false', async () => {
    vi.useFakeTimers()
    const write = createNativeClipboard(
      {
        supported: () => true,
        whenReady: () => new Promise<ClipboardBridge | undefined>(() => {}),
      },
      TIMEOUT_MS,
    )
    const writing = write(CLIPBOARD_TEXT)

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)
    await expect(writing).resolves.toBe(false)
  })
})

describe('wechat-app-prepay', () => {
  it.each(PAYMENT_CASES)('wechat-app-prepay / $replyKind -> $outcome', async (row) => {
    const pay = createWechatPay({ whenReady: async () => row.bridge }, TIMEOUT_MS)

    await expect(pay(PREPAY)).resolves.toMatchObject(row.expected)
  })

  it('wechat-app-prepay / timeout -> timedOut', async () => {
    vi.useFakeTimers()
    const { bridge } = deferredBridge()
    const pay = createWechatPay({ whenReady: async () => bridge }, TIMEOUT_MS)
    const paying = pay(PREPAY)

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS)
    await expect(paying).resolves.toMatchObject({ kind: 'timedOut' })
  })

  it('wechat-app-prepay / missing bridge -> unsupported', async () => {
    const pay = createWechatPay({ whenReady: async () => undefined }, TIMEOUT_MS)

    await expect(pay(PREPAY)).resolves.toMatchObject({ kind: 'unsupported' })
  })
})
