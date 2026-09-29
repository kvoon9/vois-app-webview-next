import { describe, expect, it } from 'vite-plus/test'
import { debugUrlPageParams, mergeDebugPageParams } from './debug-page-params'

describe('debugUrlPageParams', () => {
  it('keeps every field native itself can answer', () => {
    expect(
      debugUrlPageParams(
        '?theme=light&lang=zh-CN&login-id=441&device-type=android&pkg-name=com.vois.app&wxpay-appid=wx1&pay-method=2',
        '#/route',
      ),
    ).toEqual({
      theme: 'light',
      lang: 'zh-CN',
      'login-id': '441',
      'device-type': 'android',
      'pkg-name': 'com.vois.app',
      'wxpay-appid': 'wx1',
      'pay-method': '2',
    })
  })

  it('drops page-owned ids and unknown keys', () => {
    expect(debugUrlPageParams('?uuid=x&hardware-id=9&name=n&id=7&a=1', '#/route')).toEqual({})
  })

  it('lets the hash query win over the outer search', () => {
    expect(debugUrlPageParams('?theme=light&lang=zh-CN', '#/route?theme=dark')).toEqual({
      theme: 'dark',
      lang: 'zh-CN',
    })
  })

  it('keeps the last of a repeated key', () => {
    expect(debugUrlPageParams('?theme=light&theme=dark', '#/route?theme=blue&theme=dark')).toEqual({
      theme: 'dark',
    })
  })

  it('never injects auth keys', () => {
    expect(
      debugUrlPageParams('?access-token=t&accessToken=c&token=p&login-id=441', '#/route?token=h'),
    ).toEqual({ 'login-id': '441' })
  })

  it('handles an empty or query-less hash', () => {
    expect(debugUrlPageParams('', '')).toEqual({})
    expect(debugUrlPageParams('', '#/route')).toEqual({})
  })
})

describe('mergeDebugPageParams', () => {
  const injected = { theme: 'dark', 'login-id': '441' }

  it('lays injected params over the answer data and keeps errcode', () => {
    expect(
      mergeDebugPageParams(
        { errcode: 0, errmsg: 'ok', data: { theme: 'light', lang: 'zh-CN' } },
        {},
        injected,
      ),
    ).toEqual({
      errcode: 0,
      errmsg: 'ok',
      data: { theme: 'dark', lang: 'zh-CN', 'login-id': '441' },
    })
  })

  it('injects only the requested names', () => {
    expect(
      mergeDebugPageParams(
        { errcode: 0, errmsg: 'ok', data: { theme: 'light', lang: 'zh-CN' } },
        { page: '/a', params: ['theme'] },
        injected,
      ),
    ).toEqual({ errcode: 0, errmsg: 'ok', data: { theme: 'dark', lang: 'zh-CN' } })
  })

  it('injects everything for an empty or absent params list', () => {
    for (const request of [{}, { page: '/a' }, { page: '/a', params: [] }]) {
      expect(
        mergeDebugPageParams({ errcode: 0, errmsg: 'ok', data: {} }, request, injected),
      ).toEqual({ errcode: 0, errmsg: 'ok', data: injected })
    }
  })

  it('treats non-object data as empty', () => {
    expect(mergeDebugPageParams({ errcode: 0, errmsg: 'ok', data: [] }, {}, injected)).toEqual({
      errcode: 0,
      errmsg: 'ok',
      data: injected,
    })
    expect(mergeDebugPageParams({ errcode: 0, errmsg: 'ok' }, {}, injected)).toEqual({
      errcode: 0,
      errmsg: 'ok',
      data: injected,
    })
  })

  it('keeps a non-zero errcode', () => {
    expect(mergeDebugPageParams({ errcode: 31, errmsg: 'auth expired' }, {}, injected)).toEqual({
      errcode: 31,
      errmsg: 'auth expired',
      data: injected,
    })
  })

  it('passes a malformed response through untouched', () => {
    expect(mergeDebugPageParams('garbage', { params: ['theme'] }, injected)).toBe('garbage')
    expect(mergeDebugPageParams(null, {}, injected)).toBeNull()
    expect(mergeDebugPageParams([1, 2], {}, injected)).toEqual([1, 2])
  })

  it('never injects page ids or auth fields from a URL, even when requested', () => {
    const url = debugUrlPageParams(
      '?token=x&uuid=y&hardware-id=9&theme=dark&login-id=441',
      '#/route?access-token=z',
    )
    expect(
      mergeDebugPageParams(
        { errcode: 0, errmsg: 'ok', data: {} },
        { page: '/a', params: ['token', 'uuid', 'hardware-id', 'theme', 'login-id'] },
        url,
      ),
    ).toEqual({ errcode: 0, errmsg: 'ok', data: { theme: 'dark', 'login-id': '441' } })
  })
})
