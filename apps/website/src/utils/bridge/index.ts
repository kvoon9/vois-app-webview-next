import { isSupportBridge } from '@vois/webview-bridge'
import { getDebugAccessToken } from '@vois/webview-bridge/debug'
import { whenWebviewBridge } from '~/composables/useWebviewBridge'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import { createAppBridge } from './client'

export const bridge = createAppBridge({
  supported: isSupportBridge,
  whenReady: whenWebviewBridge,
  getPage: () => window.location.hash.slice(1).split('?')[0] || '/',
  login: import.meta.env.DEV || isWebviewDebug() ? getDebugAccessToken : undefined,
})
