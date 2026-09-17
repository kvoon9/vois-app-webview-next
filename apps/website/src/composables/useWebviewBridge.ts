import { onBridgeReady, type WebviewBridge } from '@vois/webview-bridge'
import '@vois/webview-bridge/vois'

let bridge: WebviewBridge | undefined

/** Kick off native wait once; later callers get the same instance when ready. */
onBridgeReady((b) => {
  bridge = b
})

/** Shared ready bridge, or `undefined` until native injects / unsupported env. */
export function useWebviewBridge(): WebviewBridge | undefined {
  return bridge
}

/**
 * The same wait as a promise, for callers that need the bridge rather than
 * `undefined`. Never settles on its own when native stays silent, so race it
 * against a timeout before awaiting.
 */
export function whenWebviewBridge(): Promise<WebviewBridge> {
  return new Promise((resolve) => onBridgeReady(resolve))
}
