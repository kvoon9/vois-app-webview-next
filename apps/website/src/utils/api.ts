// @env browser

import md5 from 'md5'
import { accessToken } from '~/constants'

interface WeilaResponse<T> {
  errcode: number
  errmsg: string
  data: T
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: Record<string, string | number | readonly (string | number)[] | undefined>
}

const APP_ID = import.meta.env.VITE_APP_ID
const APP_KEY = import.meta.env.VITE_APP_KEY

export async function weilaFetch<T>(
  url: string,
  options: RequestOptions = {},
): Promise<WeilaResponse<T>> {
  const urlWithAuth = buildAuthUrl(url)

  const response = await fetch(urlWithAuth, {
    method: options.method ?? 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)

  // SAFETY: the server contract guarantees the { errcode, errmsg, data } envelope; data shape is the per-endpoint T
  const data = (await response.json()) as WeilaResponse<T>
  if (data.errcode !== 0) throw new Error(`${data.errcode}: ${data.errmsg}`)

  return data
}

/** Upload a file via `/v2/common/upload-file`; resolves to the hosted URL. */
export async function weilaUpload(file: Blob, fileName: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file, fileName)

  // Content-Type must stay unset so the browser emits the multipart boundary
  const response = await fetch(buildAuthUrl('/v2/common/upload-file'), {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) throw new Error(`HTTP错误: ${response.status}`)

  // SAFETY: same envelope contract as weilaFetch
  const data = (await response.json()) as WeilaResponse<{ url: string }>
  if (data.errcode !== 0) throw new Error(`${data.errcode}: ${data.errmsg}`)
  return data.data.url
}

function buildAuthUrl(url: string): URL {
  const query = generateV2Query(APP_ID, APP_KEY)
  const urlWithAuth = new URL(url, window.location.origin)
  urlWithAuth.searchParams.set('appid', query.appid)
  urlWithAuth.searchParams.set('et', query.et)
  urlWithAuth.searchParams.set('sign', query.sign)
  urlWithAuth.searchParams.set(
    'token',
    accessToken.value || import.meta.env.VITE_ACCESS_TOKEN || '',
  )
  return urlWithAuth
}

export function generateV2Query(appid: string, appkey: string) {
  const et = Math.floor(Date.now() / 1000)
  const appSign = md5(`${et}${appkey}`)

  return {
    appid,
    et: String(et),
    sign: appSign.slice(12, 20),
  }
}
