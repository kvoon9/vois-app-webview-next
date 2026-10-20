import { describe, expect, it, vi } from 'vite-plus/test'
import { copyText, webviewClipboard, type ClipboardAccess } from './clipboard'

const url = 'http://192.168.0.1:5173/?access-token=x#/settings'

/** A clipboard double whose async write either resolves or rejects. */
function clipboardDouble(asyncWrite: 'ok' | 'reject', selectFallback = true) {
  const copyViaSelection = vi.fn(() => selectFallback)
  const clipboard: ClipboardAccess = {
    writeText: () =>
      asyncWrite === 'ok' ? Promise.resolve() : Promise.reject(new Error('blocked')),
    copyViaSelection,
  }
  return { clipboard, copyViaSelection }
}

describe('copyText', () => {
  it('copies with the async API and never touches the fallback', async () => {
    const { clipboard, copyViaSelection } = clipboardDouble('ok')

    await expect(copyText(url, clipboard)).resolves.toBe(true)
    expect(copyViaSelection).not.toHaveBeenCalled()
  })

  it('falls back to the selection command when the async API rejects', async () => {
    const { clipboard, copyViaSelection } = clipboardDouble('reject')

    await expect(copyText(url, clipboard)).resolves.toBe(true)
    expect(copyViaSelection).toHaveBeenCalledWith(url)
  })

  it('reports failure when both paths fail', async () => {
    const { clipboard, copyViaSelection } = clipboardDouble('reject', false)

    await expect(copyText(url, clipboard)).resolves.toBe(false)
    expect(copyViaSelection).toHaveBeenCalledOnce()
  })
})

describe('webviewClipboard', () => {
  it('copies through the App and never reaches the browser layers', async () => {
    const browser = clipboardDouble('ok')
    const writeNative = vi.fn(() => Promise.resolve(true))

    const copied = await copyText(url, webviewClipboard(writeNative, browser.clipboard))

    expect(copied).toBe(true)
    expect(writeNative).toHaveBeenCalledWith(url)
    expect(browser.copyViaSelection).not.toHaveBeenCalled()
  })

  it('uses the browser API when the App declines the write', async () => {
    const browser = clipboardDouble('ok')
    const writeText = vi.spyOn(browser.clipboard, 'writeText')
    const writeNative = vi.fn(() => Promise.resolve(false))

    await expect(copyText(url, webviewClipboard(writeNative, browser.clipboard))).resolves.toBe(
      true,
    )
    expect(writeText).toHaveBeenCalledWith(url)
  })

  it('falls back to the selection when the App and the browser API both fail', async () => {
    const browser = clipboardDouble('reject')
    const writeNative = vi.fn(() => Promise.reject(new Error('no bridge')))

    await expect(copyText(url, webviewClipboard(writeNative, browser.clipboard))).resolves.toBe(
      true,
    )
    expect(browser.copyViaSelection).toHaveBeenCalledWith(url)
  })
})
