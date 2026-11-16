import type { AMapPoint } from '~/composables/useAMap'
import { wgs84ToGcj02 } from '~/utils/coords'
import type { TrackPoint } from '~/utils/device-api'

/** One day point ready for AMap: GCJ-02 plus the wall-clock label. */
export interface TrackMapPoint extends AMapPoint {
  /** `YYYY-MM-DD HH:mm:ss`, device-local, display only. */
  time: string
}

export function toMapPoint(point: TrackPoint): AMapPoint {
  if (point.coordType === 1) return wgs84ToGcj02(point.lng, point.lat)
  return { lng: point.lng, lat: point.lat }
}

/** Great-circle distance in meters; the track comes in one coordinate system. */
function distance(a: TrackPoint, b: TrackPoint): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

function timeOf(point: TrackPoint): number {
  return Date.parse(point.time.replace(' ', 'T'))
}

function speed(a: TrackPoint, b: TrackPoint): number {
  const seconds = (timeOf(b) - timeOf(a)) / 1000
  return seconds > 0 ? distance(a, b) / seconds : 0
}

/**
 * Drop isolated GPS spikes the way native does: a dot flies away and comes
 * straight back. A point is a spike when both hops exceed 100 m/s while its
 * neighbours are close to each other; real movement keeps the point.
 */
export function filterJumps(points: TrackPoint[]): TrackPoint[] {
  if (points.length < 3) return points
  const kept: TrackPoint[] = []
  for (let i = 0; i < points.length; i++) {
    const point = points[i]!
    const previous = points[i - 1]
    const next = points[i + 1]
    if (previous && next) {
      const inSpeed = speed(previous, point)
      const outSpeed = speed(point, next)
      const skipSpeed = speed(previous, next)
      if (inSpeed > 100 && outSpeed > 100 && skipSpeed <= 100) continue
    }
    kept.push(point)
  }
  return kept
}

/** filterJumps then toMapPoint; order stays as received (the API now sorts). */
export function buildDayTrack(points: TrackPoint[]): TrackMapPoint[] {
  return filterJumps(points).map((point) => ({ ...toMapPoint(point), time: point.time }))
}

/** `2026-11-16 08:35:12` -> `08:35:12`; returns the input when shorter. */
export function formatTrackTime(time: string): string {
  return time.length > 11 ? time.slice(11) : time
}

/** Five-decimal `lng, lat`, the fence page's fallback. */
export function formatTrackPoint(point: AMapPoint): string {
  return `${point.lng.toFixed(5)}, ${point.lat.toFixed(5)}`
}
