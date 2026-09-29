import type { LocationQuery } from 'vue-router'
import { parseAccountId } from '~/composables/useAccountId'

/** Original entry path -> device sub-page the entry opens. */
const ENTRY_SUFFIX = new Map([
  ['/devices', ''],
  ['/devices/groups', '/groups'],
])

/**
 * The native app addresses a device with `hardware-id` on the entry path, e.g.
 * `#/devices/?hardware-id=xxx` (device info) or `#/devices/groups?hardware-id=xxx`
 * (device groups). Hash routing resolves the bare entry to the device list or to
 * `/devices/:id` with `id="groups"`, so a usable id is rewritten to the real route.
 *
 * The device-info entry without an id already is the device list, so it returns
 * null. The groups entry without a usable id redirects to the device list instead:
 * staying on `/devices/groups` would match `/devices/:id` with `id="groups"` and
 * open a device that does not exist. Any other path returns null.
 */
export function deviceEntryTarget(path: string, query: LocationQuery): { path: string } | null {
  const suffix = ENTRY_SUFFIX.get(path.replace(/\/+$/, ''))
  if (suffix === undefined) return null

  const raw = query['hardware-id']
  const id = parseAccountId(Array.isArray(raw) ? raw[0] : raw)
  if (id !== null) return { path: `/devices/${id}${suffix}` }

  return suffix === '' ? null : { path: '/devices' }
}
