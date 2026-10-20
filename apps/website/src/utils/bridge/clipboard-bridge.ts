// @env browser

import { isAndroid, isIOS, type BridgeFn } from '@vois/webview-bridge'
import { whenWebviewBridge } from '~/composables/useWebviewBridge'
import { copyText, webviewClipboard } from '~/utils/clipboard'

/**
 * Native clipboard, implemented in Android App 5.0.8 build 10201402+
 * (`WebClipboardBridge`): `write-clipboard` sets the primary clip,
 * `read-clipboard` answers the current text (empty when the clip is unreadable).
 *
 * Builds before that one dispatch nothing for these types and answer
 * `errcode: -1 "Unsupported type: write-clipboard"` (`VoisWebActivity`). Nothing
 * here can tell that answer from a refusal, and both mean the same thing: fall
 * back to the web paths. The answer is the capability, so no version check.
 */

/** Native stays silent only when the bridge never arrives; the web paths then take over. */
const NATIVE_CLIPBOARD_TIMEOUT_MS = 1_000

/**
 * `write-clipboard` request body. `sensitive` marks the clip
 * `android.content.extra.IS_SENSITIVE`, so the Android 13+ preview hides it;
 * older builds ignore the flag.
 */
export interface WriteClipboardParams {
  text: string
  sensitive?: boolean
}

export interface WriteClipboardResponse {
  errcode: number
  errmsg: string
}

/** `data.text` is the clipboard's text, `''` when the clip is empty or unreadable. */
export interface ReadClipboardResponse {
  errcode: number
  errmsg: string
  data?: { text?: string }
}

declare module '@vois/webview-bridge' {
  interface BridgeProtocolMap {
    'write-clipboard': BridgeFn<WriteClipboardParams, WriteClipboardResponse>
    'read-clipboard': BridgeFn<Record<string, never>, ReadClipboardResponse>
  }
}

/** The only part of the ready bridge a clipboard write needs. */
export interface ClipboardBridge {
  request: (type: 'write-clipboard', data: WriteClipboardParams) => Promise<WriteClipboardResponse>
}

/** What `createNativeClipboard` needs, injected so both answers are testable. */
export interface NativeClipboardSource {
  supported: () => boolean
  whenReady: () => Promise<ClipboardBridge | undefined>
}

/**
 * Builds the native write: whether this environment has one, then whether the
 * App took the text. Every failure answers `false` instead of throwing, because
 * the caller always has a web path left. That covers an unsupported environment,
 * a missing bridge, a bridge that never answers, a rejected request and any
 * `errcode` other than 0.
 */
export function createNativeClipboard(
  source: NativeClipboardSource,
  timeoutMs: number = NATIVE_CLIPBOARD_TIMEOUT_MS,
): (text: string) => Promise<boolean> {
  return async (text) => {
    if (!source.supported()) return false

    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const native = await Promise.race([
        source.whenReady(),
        new Promise<undefined>((resolve) => {
          timer = setTimeout(() => resolve(undefined), timeoutMs)
        }),
      ])
      if (!native) return false
      const response = await native.request('write-clipboard', { text })
      return response.errcode === 0
    } catch {
      return false
    } finally {
      clearTimeout(timer)
    }
  }
}

const nativeWrite = createNativeClipboard({
  /**
   * The UA, not `isSupportBridge()`: that one is also `true` on a desktop page
   * that imported the debug entry, and the debug server's bridge answers every
   * type it does not implement with a success it never performed.
   */
  supported: () => isAndroid() || isIOS(),
  whenReady: whenWebviewBridge,
})

/**
 * The one copy path: the App's clipboard when the build has it, then
 * `navigator.clipboard`, then a temporary selection. Answers whether the text
 * reached a clipboard, so a caller can report failure honestly.
 */
export function copyToClipboard(text: string): Promise<boolean> {
  return copyText(text, webviewClipboard(nativeWrite))
}
