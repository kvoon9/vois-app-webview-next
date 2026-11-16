import { shallowRef } from 'vue'
import { useAMap, type AMapPoint } from '~/composables/useAMap'

/**
 * Reverse-geocodes one point at a time for the point panel. A success is cached
 * including late replies, so reopening or stepping back is instant.
 */
export function usePointAddress() {
  const { reverseGeocode } = useAMap()
  const address = shallowRef('')
  const pending = shallowRef(false)
  const cache = new Map<string, string>()
  let request = 0

  /** `point` is the GCJ-02 map position; only the latest call may write. */
  async function load(point: AMapPoint): Promise<void> {
    const current = ++request
    const key = `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`
    const cached = cache.get(key)
    if (cached !== undefined) {
      address.value = cached
      pending.value = false
      return
    }
    // Failures leave the address empty, so the panel falls back to coordinates
    // instead of showing the previous point's address.
    address.value = ''
    pending.value = true
    try {
      const text = await reverseGeocode(point)
      cache.set(key, text)
      if (current !== request) return
      address.value = text
      pending.value = false
    } catch {
      if (current !== request) return
      address.value = ''
      pending.value = false
    }
  }

  /** Drop the display and invalidate in-flight work; the cache survives. */
  function clear(): void {
    request++
    address.value = ''
    pending.value = false
  }

  function clearCache(): void {
    cache.clear()
  }

  return { address, pending, load, clear, clearCache }
}
