import { onBridgeReady, type WebviewBridge } from '@vois/webview-bridge'
import '@vois/webview-bridge/vois'
import { emitBridgeDebugEvent } from 'vite-plugin-vois-webview-debug/bridge'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import { debugUrlPageParams, mergeDebugPageParams } from '~/utils/bridge/debug-page-params'

let bridge: WebviewBridge | undefined
let pending: Promise<WebviewBridge> | undefined

/**
 * Both directions of every call copied into the debug server's log, so a page's
 * bridge traffic is readable without instrumenting the page. Only built under
 * that server; `emitBridgeDebugEvent` has no listener anywhere else.
 *
 * Declared against the interface's own signatures, so callers keep the
 * per-protocol payload types the protocol map gives them.
 */
function mirrored(native: WebviewBridge): WebviewBridge {
  const send: WebviewBridge['send'] = (...args) => {
    emitBridgeDebugEvent({ direction: 'send', protocol: args[0], data: args[1] })
    native.send(...args)
  }

  const request: WebviewBridge['request'] = async (...args) => {
    emitBridgeDebugEvent({ direction: 'send', protocol: args[0], data: args[1] })
    try {
      const response = await native.request(...args)
      // A debug page carries its selections in the URL, and native only knows
      // the launch context, so they are laid over the answer it gave.
      const answered =
        args[0] === 'get-page-params'
          ? mergeDebugPageParams(
              response,
              args[1],
              debugUrlPageParams(window.location.search, window.location.hash),
            )
          : response
      emitBridgeDebugEvent({
        direction: 'receive',
        protocol: args[0],
        data: JSON.parse(
          JSON.stringify(answered, (key, value) =>
            key === 'access-token' || key === 'accessToken' || key === 'token'
              ? '[redacted]'
              : value,
          ),
        ),
      })
      // SAFETY: a wrapper cannot restate the caller's generic; this is native's
      // answer with debug URL params laid over `data` for get-page-params only.
      return answered as never
    } catch (error) {
      // A rejection is the case worth seeing: native's answer never arrived.
      emitBridgeDebugEvent({
        direction: 'receive',
        protocol: args[0],
        data: { error: String(error) },
      })
      throw error
    }
  }

  return { send, request }
}

/** Shared ready bridge, or `undefined` until native injects / unsupported env. */
export function useWebviewBridge(): WebviewBridge | undefined {
  return bridge
}

/**
 * The wait, for callers that need the bridge rather than `undefined`. Never settles
 * on its own when native stays silent, so race it against a timeout before awaiting.
 *
 * The wait starts here rather than at import on purpose: registering while modules
 * are still evaluating would begin it before the app can configure a bridge, which
 * is exactly what a debug session needs to do first.
 */
export function whenWebviewBridge(): Promise<WebviewBridge> {
  pending ??= new Promise<WebviewBridge>((resolve) => {
    onBridgeReady((native) => {
      bridge = isWebviewDebug() ? mirrored(native) : native
      resolve(bridge)
    })
  })
  return pending
}
