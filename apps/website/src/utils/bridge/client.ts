import { BridgeProtocolError } from '@vois/webview-bridge'
import { number, object, optional, safeParse, string } from 'valibot'
import { i18n } from '~/i18n'
import { ACCESS_TOKEN_TIMEOUT_MS } from './constants'
import { AppBridgeError } from './errors'
import type { AppBridge, BridgeSource } from './types'

const tokenResponseSchema = object({
  errcode: number(),
  errmsg: string(),
  data: optional(object({ 'access-token': optional(string()) })),
})

/** Explicit sign-in takes priority, including over a native read already in flight. */
export function createAppBridge(
  source: BridgeSource,
  timeoutMs: number = ACCESS_TOKEN_TIMEOUT_MS,
): AppBridge {
  let pending: Promise<string> | undefined

  async function readNativeAccessToken(): Promise<string> {
    if (!source.supported()) {
      throw new AppBridgeError('BRIDGE_UNAVAILABLE', i18n.global.t('app.openInApp'))
    }

    const page = source.getPage()
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutError = new AppBridgeError('BRIDGE_TIMEOUT', i18n.global.t('bridge.tokenTimeout'))

    try {
      const response = await Promise.race([
        source.whenReady().then((native) => {
          if (!active) throw timeoutError
          if (!native) {
            throw new AppBridgeError('BRIDGE_UNAVAILABLE', i18n.global.t('app.openInApp'))
          }
          return native.request('get-page-params', { page, params: ['access-token'] })
        }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(timeoutError), timeoutMs)
        }),
      ])
      const decoded = safeParse(tokenResponseSchema, response)
      if (!decoded.success) {
        throw new AppBridgeError(
          'BRIDGE_INVALID_RESPONSE',
          i18n.global.t('bridge.invalidTokenResponse'),
        )
      }
      const { errcode, data } = decoded.output
      if (errcode !== 0) {
        throw new AppBridgeError('NATIVE_ERROR', i18n.global.t('bridge.nativeError'), errcode)
      }
      if (!data?.['access-token']?.trim()) {
        throw new AppBridgeError('AUTH_REQUIRED', i18n.global.t('bridge.tokenUnavailableSignIn'))
      }
      return data['access-token']
    } catch (error) {
      if (error instanceof BridgeProtocolError) {
        throw new AppBridgeError(
          'BRIDGE_INVALID_RESPONSE',
          i18n.global.t('bridge.invalidTokenResponse'),
        )
      }
      throw error
    } finally {
      active = false
      clearTimeout(timer)
    }
  }

  async function readAccessToken(): Promise<string> {
    try {
      const token = await readNativeAccessToken()
      return readCredentialToken() ?? token
    } catch (error) {
      const credentialToken = readCredentialToken()
      if (credentialToken !== undefined) return credentialToken
      if (!source.login) throw error
      const token = await source.login()
      const selectedToken = readCredentialToken()
      if (selectedToken !== undefined) return selectedToken
      if (!token.trim()) {
        throw new AppBridgeError('AUTH_REQUIRED', i18n.global.t('bridge.tokenUnavailable'))
      }
      return token
    }
  }

  function readCredentialToken(): string | undefined {
    const token = source.credentialToken?.()
    if (token !== undefined && !token.trim()) {
      throw new AppBridgeError('AUTH_REQUIRED', i18n.global.t('bridge.tokenUnavailableAgain'))
    }
    return token
  }

  function getAccessToken(): Promise<string> {
    try {
      const token = readCredentialToken()
      if (token !== undefined) return Promise.resolve(token)
    } catch (error) {
      return Promise.reject(error)
    }
    pending ??= readAccessToken().finally(() => {
      pending = undefined
    })
    return pending
  }

  return { getAccessToken }
}
