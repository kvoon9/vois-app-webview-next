import { BridgeProtocolError } from '@vois/webview-bridge'
import { number, object, optional, safeParse, string } from 'valibot'
import { ACCESS_TOKEN_TIMEOUT_MS } from './constants'
import { AppBridgeError } from './errors'
import type { AppBridge, BridgeSource } from './types'

const tokenResponseSchema = object({
  errcode: number(),
  errmsg: string(),
  data: optional(object({ 'access-token': optional(string()) })),
})

/** Shares only an in-flight token read; retries always ask native again. */
export function createAppBridge(
  source: BridgeSource,
  timeoutMs: number = ACCESS_TOKEN_TIMEOUT_MS,
): AppBridge {
  let pending: Promise<string> | undefined

  async function readNativeAccessToken(): Promise<string> {
    if (!source.supported()) {
      throw new AppBridgeError('BRIDGE_UNAVAILABLE', '请在 App 中打开本页面。')
    }

    const page = source.getPage()
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutError = new AppBridgeError('BRIDGE_TIMEOUT', '获取登录信息超时，请重试。')

    try {
      const response = await Promise.race([
        source.whenReady().then((native) => {
          if (!active) throw timeoutError
          if (!native) {
            throw new AppBridgeError('BRIDGE_UNAVAILABLE', '请在 App 中打开本页面。')
          }
          return native.request('get-page-params', { page, params: ['access-token'] })
        }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(timeoutError), timeoutMs)
        }),
      ])
      const decoded = safeParse(tokenResponseSchema, response)
      if (!decoded.success) {
        throw new AppBridgeError('BRIDGE_INVALID_RESPONSE', 'App 返回的登录信息格式不正确。')
      }
      const { errcode, data } = decoded.output
      if (errcode !== 0) {
        throw new AppBridgeError('NATIVE_ERROR', 'App 无法提供登录信息，请重试。', errcode)
      }
      if (!data?.['access-token']?.trim()) {
        throw new AppBridgeError('AUTH_REQUIRED', '登录信息不可用，请在 App 中登录后重试。')
      }
      return data['access-token']
    } catch (error) {
      if (error instanceof BridgeProtocolError) {
        throw new AppBridgeError('BRIDGE_INVALID_RESPONSE', 'App 返回的登录信息格式不正确。')
      }
      throw error
    } finally {
      active = false
      clearTimeout(timer)
    }
  }

  async function readAccessToken(): Promise<string> {
    try {
      return await readNativeAccessToken()
    } catch (error) {
      if (!source.login) throw error
      const token = await source.login()
      if (!token.trim()) {
        throw new AppBridgeError('AUTH_REQUIRED', '登录信息不可用，请重试。')
      }
      return token
    }
  }

  function getAccessToken(): Promise<string> {
    pending ??= readAccessToken().finally(() => {
      pending = undefined
    })
    return pending
  }

  return { getAccessToken }
}
