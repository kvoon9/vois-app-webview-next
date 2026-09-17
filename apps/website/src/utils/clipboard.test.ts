import { describe, expect, it, vi } from 'vite-plus/test'
import { copyText, type ClipboardAccess } from './clipboard'

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
