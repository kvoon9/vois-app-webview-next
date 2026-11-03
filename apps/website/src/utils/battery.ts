/**
 * Icon for a device battery reading, or `null` when there is none to show.
 * The API reports `0` for an expired reading, not an empty battery, so a row
 * hides the indicator instead of printing a misleading 0%.
 *
 * Filled glyphs, because the outline battery's thin strokes smear at 12px.
 */
export function batteryIcon(level: number): string | null {
  if (level <= 0) return null
  if (level >= 80) return 'i-ph-battery-full-fill'
  if (level >= 60) return 'i-ph-battery-high-fill'
  if (level >= 40) return 'i-ph-battery-medium-fill'
  if (level >= 20) return 'i-ph-battery-low-fill'
  return 'i-ph-battery-warning-fill'
}
