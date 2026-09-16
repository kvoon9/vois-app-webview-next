import { describe, expect, it } from 'vite-plus/test'
import { deviceGroupsEntryTarget } from './device-groups-entry'

describe('deviceGroupsEntryTarget', () => {
  it('rewrites the native hardware-id entry', () => {
    expect(deviceGroupsEntryTarget('/devices/groups', { 'hardware-id': '441' })).toEqual({
      path: '/devices/441/groups',
      query: {},
    })
  })

  it('accepts a trailing slash and repeated param values', () => {
    expect(deviceGroupsEntryTarget('/devices/groups/', { 'hardware-id': ['441', '442'] })).toEqual({
      path: '/devices/441/groups',
      query: {},
    })
  })

  it('passes the other query parameters through', () => {
    expect(
      deviceGroupsEntryTarget('/devices/groups/', {
        'hardware-id': '441',
        lang: 'zh-CN',
        name: null,
      }),
    ).toEqual({ path: '/devices/441/groups', query: { lang: 'zh-CN', name: null } })
  })

  it('leaves a real device groups route alone', () => {
    expect(deviceGroupsEntryTarget('/devices/441/groups', {})).toBeNull()
  })

  it('requires a usable hardware id', () => {
    expect(deviceGroupsEntryTarget('/devices/groups', {})).toBeNull()
    expect(deviceGroupsEntryTarget('/devices/groups', { 'hardware-id': 'abc' })).toBeNull()
    expect(deviceGroupsEntryTarget('/devices/groups', { 'hardware-id': '0' })).toBeNull()
  })
})
