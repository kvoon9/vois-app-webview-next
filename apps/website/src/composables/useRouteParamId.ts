/**
 * A vue-router param as it arrives at runtime: one decoded string, repeated
 * strings, or absent. `route.params` never carries numbers or objects.
 */
export type RouteParam = string | string[] | undefined

/**
 * Read a route param as a positive safe integer. Returns null for a missing,
 * blank, non-numeric, zero, negative, or unsafe value so every device page
 * rejects an invalid id the same way.
 */
export function parseRouteParamId(value: RouteParam): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || raw.trim() === '') return null
  const number = Number(raw)
  return Number.isSafeInteger(number) && number > 0 ? number : null
}
