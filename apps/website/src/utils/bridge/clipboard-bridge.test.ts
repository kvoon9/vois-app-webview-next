import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { WriteClipboardRes } from '@vois/webview-bridge/vois'
import {
  createNativeClipboard,
  type ClipboardBridge,
  type NativeClipboardSource,
} from './clipboard-bridge'

const imei = '861490079048881'

/** A bridge whose every request is answered by `answer`, with the call recorded. */
function bridgeDouble(answer: () => Promise<WriteClipboardRes>) {
  const request = vi.fn(answer)
  const bridge: ClipboardBridge = { request }
  return { bridge, request }
}

function source(
  whenReady: () => Promise<ClipboardBridge | undefined>,
  supported = () => true,
): NativeClipboardSource {
  return { supported, whenReady }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createNativeClipboard', () => {
  it('copies through the App and reports success', async () => {
    const { bridge, request } = bridgeDouble(() => Promise.resolve({ errcode: 0, errmsg: '' }))
    const write = createNativeClipboard(source(() => Promise.resolve(bridge)))

    await expect(write(imei)).resolves.toBe(true)
    expect(request).toHaveBeenCalledWith('write-clipboard', { text: imei })
  })

  it('declines without asking when the environment has no App clipboard', async () => {
    const whenReady = vi.fn(() => Promise.resolve(undefined))
    const write = createNativeClipboard(source(whenReady, () => false))

    await expect(write(imei)).resolves.toBe(false)
    expect(whenReady).not.toHaveBeenCalled()
  })

  it('declines on a build that dispatches no handler for the type', async () => {
    const { bridge } = bridgeDouble(() =>
      Promise.resolve({ errcode: -1, errmsg: 'Unsupported type: write-clipboard' }),
    )
    const write = createNativeClipboard(source(() => Promise.resolve(bridge)))

    await expect(write(imei)).resolves.toBe(false)
  })

  it('declines when the request itself rejects', async () => {
    const { bridge } = bridgeDouble(() => Promise.reject(new Error('bridge tore down')))
    const write = createNativeClipboard(source(() => Promise.resolve(bridge)))

    await expect(write(imei)).resolves.toBe(false)
  })

  it('declines when the bridge never arrives, without waiting on it forever', async () => {
    vi.useFakeTimers()
    const write = createNativeClipboard(
      source(() => new Promise<undefined>(() => {})),
      1_000,
    )

    const copying = write(imei)
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(copying).resolves.toBe(false)
  })
})
