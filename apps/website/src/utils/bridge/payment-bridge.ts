// @env browser

import type { WechatPayRes, WechatPrepay } from '@vois/webview-bridge/vois'
import { whenWebviewBridge } from '~/composables/useWebviewBridge'
import { i18n } from '~/i18n'

/**
 * One native answer, normalized to what the page can act on. WeChat only takes
 * the money when the bridge reports both `errcode` and `wxpaycode` as zero.
 */
export type WechatPayOutcome =
  | { kind: 'paid'; response: WechatPayRes }
  | { kind: 'unsupported'; message: string }
  | { kind: 'timedOut'; message: string }
  | { kind: 'failed'; message: string; code?: number }

/**
 * Native's pending callback is keyed by `prepayid`. A WeChat-side rejection
 * before its `PayResp` never matches that key, so the bridge can wait forever.
 * Two minutes leaves a normal WeChat round trip intact.
 */
export const WECHAT_PAY_TIMEOUT_MS = 120_000

export interface PaymentBridge {
  request: (type: 'wechat-app-prepay', data: WechatPrepay) => Promise<WechatPayRes>
}

/** Where the bridge comes from; injectable so both answers are testable. */
export interface PaymentBridgeSource {
  /** Resolves with the ready bridge, or `undefined` where native never injects one. */
  whenReady: () => Promise<PaymentBridge | undefined>
}

/**
 * Native's answer is untyped until parsed: iOS 5.0.6 answers an unregistered
 * action with `{ success, message }` instead of the protocol's `errcode`.
 */
interface WechatPayBridgeResponse {
  errcode?: number
  errmsg?: string
  success?: boolean
  message?: string
  data?: { wxpaycode?: number }
}

/** Reads the protocol answer. A missing `errcode` means the action was not handled. */
function classifyWechatPay(response: WechatPayRes): WechatPayOutcome {
  const answer: WechatPayBridgeResponse = response
  const message = answer.errmsg ?? answer.message ?? ''
  if (answer.errcode === undefined) {
    return { kind: 'unsupported', message: i18n.global.t('device.payUnsupported') }
  }
  if (answer.errcode !== 0) {
    return {
      kind: 'failed',
      message: message || i18n.global.t('device.payFailedHint'),
      code: answer.errcode,
    }
  }
  const wxpaycode = answer.data?.wxpaycode
  if (wxpaycode !== 0) {
    return wxpaycode === undefined
      ? { kind: 'failed', message: i18n.global.t('device.payFailedHint') }
      : { kind: 'failed', message: i18n.global.t('device.payFailedHint'), code: wxpaycode }
  }
  return { kind: 'paid', response }
}

/** One bridge attempt. A rejected request and a missing bridge both become outcomes. */
async function payThroughBridge(
  source: PaymentBridgeSource,
  prepay: WechatPrepay,
): Promise<WechatPayOutcome> {
  let native: PaymentBridge | undefined
  try {
    native = await source.whenReady()
  } catch (error) {
    return {
      kind: 'failed',
      message:
        error instanceof Error && error.message
          ? error.message
          : i18n.global.t('device.payFailedHint'),
    }
  }
  if (!native) return { kind: 'unsupported', message: i18n.global.t('device.payUnsupported') }

  try {
    return classifyWechatPay(await native.request('wechat-app-prepay', prepay))
  } catch (error) {
    return {
      kind: 'failed',
      message:
        error instanceof Error && error.message
          ? error.message
          : i18n.global.t('device.payFailedHint'),
    }
  }
}

/** The promise's value, or `undefined` once it outlasts `ms`. */
async function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Bounds the whole bridge attempt, including the wait for the bridge itself.
 * The page never sees a throw, and a wait that outlives the deadline reports an
 * unknown result instead of staying in `paying`.
 */
export function createWechatPay(
  source: PaymentBridgeSource,
  timeoutMs: number = WECHAT_PAY_TIMEOUT_MS,
): (prepay: WechatPrepay) => Promise<WechatPayOutcome> {
  return async (prepay) => {
    const outcome = await withDeadline(payThroughBridge(source, prepay), timeoutMs)
    return outcome ?? { kind: 'timedOut', message: i18n.global.t('device.payResultUnknown') }
  }
}

export const requestWechatPay = createWechatPay({ whenReady: whenWebviewBridge })
