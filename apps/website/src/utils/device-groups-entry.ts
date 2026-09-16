import type { LocationQuery } from 'vue-router'
import { parseAccountId } from '~/composables/useAccountId'

/** The one path the native app opens when it wants a device's groups. */
const ENTRY_PATH = '/devices/groups'

/**
 * The native app opens the device groups page as `#/devices/groups?hardware-id=xxx`.
 * Hash routing sees only that fragment, so `/devices/groups` matches the dynamic
 * `/devices/:id` route with `id="groups"` and renders an empty device page. This
 * rewrites the entry to the real groups route, carrying every other query along
 * and dropping `hardware-id` so the id cannot leak into the page.
 *
 * Returns null for anything that is not that entry, including a real
 * `/devices/<id>/groups` navigation.
 */
export function deviceGroupsEntryTarget(
  path: string,
  query: LocationQuery,
): { path: string; query: LocationQuery } | null {
  if (path.replace(/\/+$/, '') !== ENTRY_PATH) return null

  const raw = query['hardware-id']
  const hardwareId = Array.isArray(raw) ? raw[0] : raw
  if (hardwareId == null || parseAccountId(hardwareId) == null) return null

  const { 'hardware-id': _, ...rest } = query
  return { path: `/devices/${hardwareId}/groups`, query: rest }
}
