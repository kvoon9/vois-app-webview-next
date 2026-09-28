// @env browser

import { shallowRef } from 'vue'

/**
 * The access-token, resolved on every read instead of cached.
 *
 * There is one source: the bridge. Native answers `get-page-params` with the live
 * token, and under a debug server the debug entry answers with one it logged in
 * for, so the page cannot tell the two apart.
 */
const bridgeToken = shallowRef('')

/**
 * Resolves once the boot load has finished, whether or not it found a token.
 *
 * This is what bounds `whenAccessToken`: the bridge attempt already has its own
 * timeout, so waits end with the bridge rather than with a second guess at how
 * long native may take.
 */
let settleBootLoad: () => void = () => {}
const bootLoadFinished = new Promise<void>((resolve) => {
  settleBootLoad = resolve
})

/**
 * The boot load's outcome: a token, or nothing. Either way the wait is over.
 *
 * An empty token is ignored rather than stored, so a silent bridge never clears
 * one that already works; it still ends the wait, because nothing more is coming.
 */
export function resolveBridgeAccessToken(token: string | null | undefined): void {
  if (token) bridgeToken.value = token
  settleBootLoad()
}

/** What the page currently has, for rendering. Empty means the request will fail. */
export function getAccessToken(): string {
  return bridgeToken.value
}

/**
 * The token to send, once the boot load has settled. Throws when there is none, so
 * a request fails at the client boundary with a reason instead of reaching the
 * server and coming back as `errcode 20 参数错误`.
 */
export async function whenAccessToken(): Promise<string> {
  await bootLoadFinished
  if (!bridgeToken.value) throw new Error('登录信息不可用，请在 App 中重新打开本页面。')
  return bridgeToken.value
}
