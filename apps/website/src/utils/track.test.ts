import { describe, expect, it } from 'vite-plus/test'
import type { TrackPoint } from './device-api'
import { buildDayTrack, formatTrackPoint, formatTrackTime } from './track'

function point(lng: number, lat: number, time: string, coordType: 0 | 1 = 0): TrackPoint {
  return { lng, lat, time, radius: 0, coordType }
}

describe('day track', () => {
  it('keeps the order it receives', () => {
    const points = [
      point(121.4, 31.2, '2026-02-11 08:30:15'),
      point(121.5, 31.3, '2026-02-11 19:05:09'),
    ]

    expect(buildDayTrack(points).map(({ time }) => time)).toEqual([
      '2026-02-11 08:30:15',
      '2026-02-11 19:05:09',
    ])
  })

  it('drops a spike that flies out and comes straight back', () => {
    const points = [
      point(121.4, 31.2, '2026-02-11 08:00:00'),
      point(121.5, 31.3, '2026-02-11 08:00:05'),
      point(121.4001, 31.2, '2026-02-11 08:00:10'),
    ]

    expect(buildDayTrack(points).map(({ time }) => time)).toEqual([
      '2026-02-11 08:00:00',
      '2026-02-11 08:00:10',
    ])
  })

  it('shifts wgs84 points into gcj02 and keeps gcj02 as is', () => {
    const [wgs, gcj] = buildDayTrack([
      point(121.4, 31.2, '2026-02-11 08:00:00', 1),
      point(121.4, 31.2, '2026-02-11 08:00:01', 0),
    ])

    expect(wgs).toEqual({
      lng: 121.40464868048423,
      lat: 31.198150256565185,
      rawLng: 121.4,
      rawLat: 31.2,
      radius: 0,
      coordType: 1,
      time: '2026-02-11 08:00:00',
    })
    expect(gcj).toEqual({
      lng: 121.4,
      lat: 31.2,
      rawLng: 121.4,
      rawLat: 31.2,
      radius: 0,
      coordType: 0,
      time: '2026-02-11 08:00:01',
    })
  })

  it('formats the display time and the coordinate fallback', () => {
    expect(formatTrackTime('2026-11-16 08:35:12')).toBe('08:35:12')
    expect(formatTrackTime('08:35')).toBe('08:35')
    expect(formatTrackPoint({ lng: 121.4, lat: 31.2 })).toBe('121.40000, 31.20000')
  })
})
