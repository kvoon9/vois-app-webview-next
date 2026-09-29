import type { BridgeErrorCode } from './types'

export class AppBridgeError extends Error {
  readonly code: BridgeErrorCode
  readonly nativeCode?: number

  constructor(code: BridgeErrorCode, message: string, nativeCode?: number) {
    super(message)
    this.name = 'AppBridgeError'
    this.code = code
    this.nativeCode = nativeCode
  }
}
