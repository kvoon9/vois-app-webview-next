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
 * `/devices/:id` with `id="groups"`, so both are rewritten to the real route,
 * carrying every other query along and dropping `hardware-id` so the id cannot
 * leak into the page.
 *
 * Returns null for anything that is not an entry, including a real
 * `/devices/<id>` navigation.
 */
export function deviceEntryTarget(
  path: string,
  query: LocationQuery,
): { path: string; query: LocationQuery } | null {
  const suffix = ENTRY_SUFFIX.get(path.replace(/\/+$/, ''))
  if (suffix === undefined) return null

  const raw = query['hardware-id']
  const hardwareId = Array.isArray(raw) ? raw[0] : raw
  if (hardwareId == null || parseAccountId(hardwareId) == null) return null

  const { 'hardware-id': _, ...rest } = query
  return { path: `/devices/${hardwareId}${suffix}`, query: rest }
}
