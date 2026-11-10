import type { WechatPayRes } from '@vois/webview-bridge/vois'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { RenewOrderResult } from '~/utils/device-api'
import { renewPayParams, useWechatRenewPayment } from './useWechatRenewPayment'

const mocks = vi.hoisted(() => ({
  createRenewOrder: vi.fn(),
  createWechatAppOrder: vi.fn(),
  confirmWechatPayment: vi.fn(),
  request: vi.fn(),
  whenWebviewBridge: vi.fn(),
}))

vi.mock('~/utils/device-api', () => ({
  createRenewOrder: mocks.createRenewOrder,
  createWechatAppOrder: mocks.createWechatAppOrder,
  confirmWechatPayment: mocks.confirmWechatPayment,
}))

vi.mock('~/composables/useWebviewBridge', () => ({
  whenWebviewBridge: mocks.whenWebviewBridge,
}))

const order: RenewOrderResult = {
  orderNo: 'RN20260211',
  amount: 2900,
  currency: 'CNY',
  productId: 'pkg_year',
  productName: '年卡',
  productDesc: '语音年卡',
}

const wechatOrder = {
  orderNo: 'RN20260211',
  tradeNo: 'WX20260211',
  prepay: {
    partnerid: '1900000109',
    prepayid: 'wx201410272009395522657a690389285100',
    noncestr: '5K8264ILTKCH16CQ2502SI8ZNMTM67VS',
    timestamp: 1414563803,
    sign: 'C380BEC2BFD727A4B6845133519F3AD6',
  },
}

const paidAnswer: WechatPayRes = { errcode: 0, errmsg: 'ok', data: { wxpaycode: 0 } }

function makePayment(onPaid?: () => void | Promise<void>) {
  return useWechatRenewPayment({
    payMethod: () => 'wechat',
    pkgName: 'com.voistech.weila',
    wxpayAppId: () => 'wx4cc2b3ab0de3dd13',
    onPaid,
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.whenWebviewBridge.mockResolvedValue({ request: mocks.request })
})

afterEach(() => vi.useRealTimers())

describe('renewPayParams', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('always pays with WeChat and falls back to the iOS app defaults', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    })

    expect(renewPayParams({ 'pay-method': 'apple_iap' })).toEqual({
      pkgName: 'com.voistech.wechat',
      wxpayAppId: 'wx4cc2b3ab0de3dd13',
    })
  })

  it('prefers the values native sends over the defaults', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 13)' })

    expect(
      renewPayParams({
        'pay-method': 'apple_iap',
        'pkg-name': 'com.voistech.custom',
        'wxpay-appid': 'wxCustom',
      }),
    ).toEqual({
      pkgName: 'com.voistech.custom',
      wxpayAppId: 'wxCustom',
    })
  })
})

describe('useWechatRenewPayment', () => {
  it('creates the order and stops at confirmation', async () => {
    mocks.createRenewOrder.mockResolvedValue(order)
    const payment = makePayment()

    await payment.start('8986')

    expect(mocks.createRenewOrder).toHaveBeenCalledWith({
      iccid: '8986',
      payMethod: 'wechat',
      pkgName: 'com.voistech.weila',
    })
    expect(payment.state.value).toEqual({ kind: 'confirming', order })
  })

  it('reports a failed order creation with nothing to retry', async () => {
    mocks.createRenewOrder.mockRejectedValue(new Error('SIM卡有效期超过半年,暂不支持续费'))
    const payment = makePayment()

    await payment.start('8986')

    expect(payment.state.value).toEqual({
      kind: 'failed',
      order: null,
      message: 'SIM卡有效期超过半年,暂不支持续费',
      canRetry: false,
    })
  })

  it('pays through the bridge, confirms the trade and notifies the page', async () => {
    mocks.createWechatAppOrder.mockResolvedValue(wechatOrder)
    mocks.request.mockResolvedValue(paidAnswer)
    mocks.confirmWechatPayment.mockResolvedValue(undefined)
    const onPaid = vi.fn()
    const payment = makePayment(onPaid)

    await payment.payOrder(order)

    expect(mocks.createWechatAppOrder).toHaveBeenCalledWith({
      appId: 'wx4cc2b3ab0de3dd13',
      orderNo: 'RN20260211',
      productId: 'pkg_year',
    })
    expect(mocks.request).toHaveBeenCalledWith('wechat-app-prepay', wechatOrder.prepay)
    expect(mocks.confirmWechatPayment).toHaveBeenCalledWith({
      orderNo: 'RN20260211',
      tradeNo: 'WX20260211',
    })
    expect(onPaid).toHaveBeenCalledOnce()
    expect(payment.state.value).toEqual({ kind: 'success', order, serverConfirmed: true })
  })

  it('fails with the native message when the bridge reports an error code', async () => {
    mocks.createWechatAppOrder.mockResolvedValue(wechatOrder)
    mocks.request.mockResolvedValue({ errcode: -1, errmsg: '支付失败' })
    const payment = makePayment()

    await payment.payOrder(order)

    expect(mocks.confirmWechatPayment).not.toHaveBeenCalled()
    expect(payment.state.value).toMatchObject({
      kind: 'failed',
      order,
      message: '支付失败',
      canRetry: true,
    })
  })

  it('fails without confirming when WeChat reports a non-zero code', async () => {
    mocks.createWechatAppOrder.mockResolvedValue(wechatOrder)
    mocks.request.mockResolvedValue({ errcode: 0, errmsg: 'ok', data: { wxpaycode: -1 } })
    const payment = makePayment()

    await payment.payOrder(order)

    expect(mocks.confirmWechatPayment).not.toHaveBeenCalled()
    expect(payment.state.value).toMatchObject({ kind: 'failed', order, canRetry: true })
  })

  it('treats an unregistered bridge action as unsupported and stays put', async () => {
    mocks.createWechatAppOrder.mockResolvedValue(wechatOrder)
    mocks.request.mockResolvedValue({ success: false, message: 'Unknown action' })
    const payment = makePayment()

    await payment.payOrder(order)

    expect(mocks.confirmWechatPayment).not.toHaveBeenCalled()
    expect(payment.state.value).toMatchObject({ kind: 'failed', order, canRetry: false })
    if (payment.state.value.kind === 'failed') {
      expect(payment.state.value.message).toContain('support in-page payment')
    }

    await payment.retry()
    expect(mocks.createWechatAppOrder).toHaveBeenCalledTimes(1)
  })

  it('ignores payOrder while the order is being created', async () => {
    let finishCreate: ((value: RenewOrderResult) => void) | undefined
    mocks.createRenewOrder.mockReturnValue(
      new Promise<RenewOrderResult>((resolve) => {
        finishCreate = resolve
      }),
    )
    const payment = makePayment()

    const creating = payment.start('8986')
    await payment.payOrder(order)

    expect(mocks.createWechatAppOrder).not.toHaveBeenCalled()

    finishCreate?.(order)
    await creating
    expect(payment.state.value).toEqual({ kind: 'confirming', order })
  })

  it('ignores a second pay while the first is in flight', async () => {
    mocks.createWechatAppOrder.mockResolvedValue(wechatOrder)
    let answer: ((value: WechatPayRes) => void) | undefined
    mocks.request.mockReturnValue(
      new Promise<WechatPayRes>((resolve) => {
        answer = resolve
      }),
    )
    const payment = makePayment()

    const first = payment.payOrder(order)
    const second = payment.payOrder(order)

    expect(mocks.createWechatAppOrder).toHaveBeenCalledTimes(1)

    answer?.(paidAnswer)
    await Promise.all([first, second])
    expect(mocks.createWechatAppOrder).toHaveBeenCalledTimes(1)
  })

  it('leaves paying with an unknown result after the long bridge wait', async () => {
    vi.useFakeTimers()
    mocks.createWechatAppOrder.mockResolvedValue(wechatOrder)
    mocks.request.mockReturnValue(new Promise<WechatPayRes>(() => {}))
    const payment = makePayment()

    const paying = payment.payOrder(order)
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(1)
    expect(payment.state.value.kind).toBe('paying')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(payment.state.value.kind).toBe('paying')

    await vi.advanceTimersByTimeAsync(60_000)
    await paying

    expect(mocks.confirmWechatPayment).not.toHaveBeenCalled()
    expect(payment.state.value).toMatchObject({ kind: 'failed', order, canRetry: false })
    if (payment.state.value.kind === 'failed') {
      expect(payment.state.value.message).toContain('unknown')
    }
  })

  it('keeps the payment successful when the server confirmation fails', async () => {
    mocks.createWechatAppOrder.mockResolvedValue(wechatOrder)
    mocks.request.mockResolvedValue(paidAnswer)
    mocks.confirmWechatPayment.mockRejectedValue(new Error('notify failed'))
    const onPaid = vi.fn()
    const payment = makePayment(onPaid)

    await payment.payOrder(order)

    expect(payment.state.value).toEqual({ kind: 'success', order, serverConfirmed: false })
    expect(onPaid).toHaveBeenCalledOnce()
  })

  it('retries a failed order with a fresh prepay', async () => {
    mocks.createWechatAppOrder.mockResolvedValue(wechatOrder)
    mocks.request
      .mockResolvedValueOnce({ errcode: 0, errmsg: 'ok', data: { wxpaycode: -1 } })
      .mockResolvedValueOnce(paidAnswer)
    mocks.confirmWechatPayment.mockResolvedValue(undefined)
    const payment = makePayment()

    await payment.payOrder(order)
    expect(payment.state.value).toMatchObject({ kind: 'failed', canRetry: true })

    await payment.retry()

    expect(mocks.createWechatAppOrder).toHaveBeenCalledTimes(2)
    expect(payment.state.value).toEqual({ kind: 'success', order, serverConfirmed: true })
  })

  it('starts a new order on every entry', async () => {
    const secondOrder = { ...order, orderNo: 'RN20260212' }
    mocks.createRenewOrder.mockResolvedValueOnce(order).mockResolvedValueOnce(secondOrder)
    const payment = makePayment()

    await payment.start('8986')
    payment.reset()
    await payment.start('8986')

    expect(mocks.createRenewOrder).toHaveBeenCalledTimes(2)
    expect(payment.state.value).toEqual({ kind: 'confirming', order: secondOrder })
  })
})
