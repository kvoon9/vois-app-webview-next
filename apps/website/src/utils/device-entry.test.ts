import { describe, expect, it } from 'vite-plus/test'
import { deviceEntryTarget } from './device-entry'

describe('deviceEntryTarget', () => {
  it('rewrites the native device entry', () => {
    expect(deviceEntryTarget('/devices', { 'hardware-id': '441' })).toEqual({
      path: '/devices/441',
    })
    expect(deviceEntryTarget('/devices/', { 'hardware-id': '441' })).toEqual({
      path: '/devices/441',
    })
  })

  it('rewrites the native device groups entry', () => {
    expect(deviceEntryTarget('/devices/groups', { 'hardware-id': '441' })).toEqual({
      path: '/devices/441/groups',
    })
  })

  it('accepts a trailing slash and keeps the first of repeated values', () => {
    expect(deviceEntryTarget('/devices/groups/', { 'hardware-id': ['441', '442'] })).toEqual({
      path: '/devices/441/groups',
    })
  })

  it('falls back to the device list for an id-less entry', () => {
    expect(deviceEntryTarget('/devices', {})).toBeNull()
    expect(deviceEntryTarget('/devices', { 'hardware-id': 'abc' })).toBeNull()

    // The groups entry must not stay on a path that matches /devices/:id.
    expect(deviceEntryTarget('/devices/groups', {})).toEqual({ path: '/devices' })
    expect(deviceEntryTarget('/devices/groups/', { 'hardware-id': '0' })).toEqual({
      path: '/devices',
    })
  })

  it('leaves real device routes alone', () => {
    expect(deviceEntryTarget('/devices/441', {})).toBeNull()
    expect(deviceEntryTarget('/devices/441/groups', {})).toBeNull()
    expect(deviceEntryTarget('/devices/441', { 'hardware-id': '442' })).toBeNull()
  })

  it('drops the id from the page path', () => {
    const target = deviceEntryTarget('/devices/groups', { 'hardware-id': '441' })
    expect(target).toEqual({ path: '/devices/441/groups' })
    expect(Object.keys(target ?? {})).toEqual(['path'])
  })
})
