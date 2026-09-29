import type { WebviewBridge } from '@vois/webview-bridge'

export interface BridgeSource {
  supported: () => boolean
  whenReady: () => Promise<WebviewBridge | undefined>
  getPage: () => string
  login?: () => Promise<string>
}

export interface AppBridge {
  getAccessToken: () => Promise<string>
}

export type BridgeErrorCode =
  | 'BRIDGE_UNAVAILABLE'
  | 'BRIDGE_TIMEOUT'
  | 'BRIDGE_INVALID_RESPONSE'
  | 'NATIVE_ERROR'
  | 'AUTH_REQUIRED'
