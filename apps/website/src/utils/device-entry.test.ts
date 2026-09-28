import { describe, expect, it } from 'vite-plus/test'
import { deviceEntryTarget } from './device-entry'

describe('deviceEntryTarget', () => {
  it('rewrites the native device entry', () => {
    expect(deviceEntryTarget('/devices', { 'hardware-id': '441' })).toEqual({
      path: '/devices/441',
      query: {},
    })
    expect(deviceEntryTarget('/devices/', { 'hardware-id': '441' })).toEqual({
      path: '/devices/441',
      query: {},
    })
  })

  it('rewrites the native device groups entry', () => {
    expect(deviceEntryTarget('/devices/groups', { 'hardware-id': '441' })).toEqual({
      path: '/devices/441/groups',
      query: {},
    })
  })

  it('accepts a trailing slash and repeated param values', () => {
    expect(deviceEntryTarget('/devices/groups/', { 'hardware-id': ['441', '442'] })).toEqual({
      path: '/devices/441/groups',
      query: {},
    })
  })

  it('passes the other query parameters through', () => {
    expect(
      deviceEntryTarget('/devices/groups/', {
        'hardware-id': '441',
        lang: 'zh-CN',
        name: null,
      }),
    ).toEqual({ path: '/devices/441/groups', query: { lang: 'zh-CN', name: null } })
  })

  it('leaves real device routes alone', () => {
    expect(deviceEntryTarget('/devices/441', {})).toBeNull()
    expect(deviceEntryTarget('/devices/441/groups', {})).toBeNull()
    expect(deviceEntryTarget('/devices/441', { 'hardware-id': '442' })).toBeNull()
  })

  it('requires a usable hardware id', () => {
    expect(deviceEntryTarget('/devices', {})).toBeNull()
    expect(deviceEntryTarget('/devices', { 'hardware-id': 'abc' })).toBeNull()
    expect(deviceEntryTarget('/devices/groups', { 'hardware-id': '0' })).toBeNull()
  })
})
