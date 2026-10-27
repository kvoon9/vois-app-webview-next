const WGS84_SEMI_MAJOR = 6378245
const WGS84_ECC_SQUARED = 0.006693421622965943

/** Latitude offset term of the standard WGS-84 to GCJ-02 approximation. */
function transformLat(x: number, y: number): number {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  ret += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3
  ret += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3
  return ret
}

/** Longitude offset term of the same approximation. */
function transformLng(x: number, y: number): number {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  ret += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3
  ret += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3
  return ret
}

/**
 * Approximate WGS-84 to GCJ-02 conversion, precise to a few meters. AMap only
 * draws GCJ-02, so GPS points (coordType 1) are shifted before they go on the
 * map; the error is far below what a track polyline makes visible.
 */
export function wgs84ToGcj02(lng: number, lat: number) {
  let dLat = transformLat(lng - 105, lat - 35)
  let dLng = transformLng(lng - 105, lat - 35)
  const radLat = (lat / 180) * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - WGS84_ECC_SQUARED * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat =
    (dLat * 180) / (((WGS84_SEMI_MAJOR * (1 - WGS84_ECC_SQUARED)) / (magic * sqrtMagic)) * Math.PI)
  dLng = (dLng * 180) / ((WGS84_SEMI_MAJOR / sqrtMagic) * Math.cos(radLat) * Math.PI)
  return { lng: lng + dLng, lat: lat + dLat }
}
