import { describe, expect, it } from 'vite-plus/test'
import { wgs84ToGcj02 } from './coords'

/**
 * Characterization goldens: today's track.vue output for mainland cities,
 * pinned before the formula moved, so the extraction stays bit-identical.
 */
describe('wgs84ToGcj02', () => {
  it('shifts mainland GPS points by the known offsets', () => {
    // toEqual still compares each number with Object.is, so the digits are exact.
    expect(wgs84ToGcj02(114.0668, 22.6305)).toEqual({
      lng: 114.07192836876777,
      lat: 22.627807751583635,
    })
    expect(wgs84ToGcj02(121.4, 31.2)).toEqual({
      lng: 121.40464868048423,
      lat: 31.198150256565185,
    })
    expect(wgs84ToGcj02(116.4, 39.9)).toEqual({
      lng: 116.40624278491117,
      lat: 39.901403529849404,
    })
    expect(wgs84ToGcj02(104.06, 30.67)).toEqual({
      lng: 104.06249640425462,
      lat: 30.66757487197054,
    })
  })

  it('keeps the Shenzhen shift inside the 100-700 m band the map shows', () => {
    const start = { lng: 114.0668, lat: 22.6305 }
    const shifted = wgs84ToGcj02(start.lng, start.lat)
    const rad = Math.PI / 180
    const dLat = (shifted.lat - start.lat) * rad
    const dLng = (shifted.lng - start.lng) * rad
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(start.lat * rad) * Math.cos(start.lat * rad) * Math.sin(dLng / 2) ** 2
    const meters = 2 * 6371000 * Math.asin(Math.sqrt(h))
    expect(meters).toBeGreaterThan(100)
    expect(meters).toBeLessThan(700)
  })
})
