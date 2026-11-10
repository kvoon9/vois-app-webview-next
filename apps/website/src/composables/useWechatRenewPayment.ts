import { isIOS } from '@vois/webview-bridge'
import { shallowRef, toValue, type MaybeRefOrGetter, type ShallowRef } from 'vue'
import { requestWechatPay } from '~/utils/bridge/payment-bridge'
import {
  confirmWechatPayment,
  createRenewOrder,
  createWechatAppOrder,
  type RenewOrderResult,
} from '~/utils/device-api'
import type { PageParams } from './usePageParams'

export type RenewPaymentState =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'confirming'; order: RenewOrderResult }
  | { kind: 'paying'; order: RenewOrderResult }
  /** WeChat paid; `serverConfirmed` is false when telling the server failed. */
  | { kind: 'success'; order: RenewOrderResult; serverConfirmed: boolean }
  | { kind: 'failed'; order: RenewOrderResult | null; message: string; canRetry: boolean }

export interface RenewPayParams {
  pkgName: string
  wxpayAppId: string
}

/**
 * Native's own app id, used only when it sends none. Native ignores the value on
 * Android, and an iOS build may ship a different one.
 */
const DEFAULT_WXPAY_APP_ID = 'wx4cc2b3ab0de3dd13'

export function renewPayParams(params: PageParams): RenewPayParams {
  return {
    pkgName: params['pkg-name'] ?? (isIOS() ? 'com.voistech.wechat' : 'com.voistech.weila'),
    wxpayAppId: params['wxpay-appid'] ?? DEFAULT_WXPAY_APP_ID,
  }
}

export interface UseWechatRenewPaymentOptions {
  payMethod: MaybeRefOrGetter<'wechat'>
  pkgName: MaybeRefOrGetter<string>
  wxpayAppId: MaybeRefOrGetter<string>
  /** Runs after WeChat reported success, so the page can refetch its data. */
  onPaid?: () => void | Promise<void>
}

export interface WechatRenewPayment {
  state: ShallowRef<RenewPaymentState>
  /** Create the order for one card and stop at the confirmation step. */
  start: (iccid: string) => Promise<void>
  /** Pay an order the page already created and accepted. */
  payOrder: (order: RenewOrderResult) => Promise<void>
  /** Pay the failed order again; each attempt asks for a fresh prepay. */
  retry: () => Promise<void>
  reset: () => void
}

/**
 * One renewal payment at a time. A pending order creation or payment owns the
 * state, so a second tap is ignored rather than starting a parallel attempt.
 */
export function useWechatRenewPayment(options: UseWechatRenewPaymentOptions): WechatRenewPayment {
  const state = shallowRef<RenewPaymentState>({ kind: 'idle' })

  function busy(): boolean {
    return state.value.kind === 'creating' || state.value.kind === 'paying'
  }

  async function start(iccid: string): Promise<void> {
    if (busy()) return
    state.value = { kind: 'creating' }
    try {
      const order = await createRenewOrder({
        iccid,
        payMethod: toValue(options.payMethod),
        pkgName: toValue(options.pkgName),
      })
      state.value = { kind: 'confirming', order }
    } catch (error) {
      state.value = {
        kind: 'failed',
        order: null,
        message: error instanceof Error && error.message ? error.message : String(error),
        canRetry: false,
      }
    }
  }

  async function payOrder(order: RenewOrderResult): Promise<void> {
    if (busy()) return
    state.value = { kind: 'paying', order }
    try {
      const wechatOrder = await createWechatAppOrder({
        appId: toValue(options.wxpayAppId),
        orderNo: order.orderNo,
        productId: order.productId,
      })
      const outcome = await requestWechatPay(wechatOrder.prepay)
      if (outcome.kind === 'unsupported' || outcome.kind === 'timedOut') {
        // A timed-out attempt may still have charged the user, so retrying
        // could pay twice; its message points at the recharge records instead.
        state.value = { kind: 'failed', order, message: outcome.message, canRetry: false }
        return
      }
      if (outcome.kind === 'failed') {
        state.value = { kind: 'failed', order, message: outcome.message, canRetry: true }
        return
      }

      let serverConfirmed = true
      try {
        await confirmWechatPayment({ orderNo: wechatOrder.orderNo, tradeNo: wechatOrder.tradeNo })
      } catch {
        // WeChat already took the money, so a failed confirmation lowers
        // confidence in the record but does not undo the payment.
        serverConfirmed = false
      }
      state.value = { kind: 'success', order, serverConfirmed }
      try {
        await options.onPaid?.()
      } catch {
        // A page refetch must not turn a completed payment into a failure.
      }
    } catch (error) {
      state.value = {
        kind: 'failed',
        order,
        message: error instanceof Error && error.message ? error.message : String(error),
        canRetry: true,
      }
    }
  }

  async function retry(): Promise<void> {
    const current = state.value
    if (current.kind !== 'failed' || current.order === null || !current.canRetry) return
    await payOrder(current.order)
  }

  function reset(): void {
    if (busy()) return
    state.value = { kind: 'idle' }
  }

  return { state, start, payOrder, retry, reset }
}
