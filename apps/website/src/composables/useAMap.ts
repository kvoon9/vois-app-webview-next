// @env browser

import { load as loadAMapSdk } from '@amap/amap-jsapi-loader'
import { computed, shallowRef } from 'vue'

export interface AMapPoint {
  lng: number
  lat: number
}

export interface AMapControl {
  addTo?: (map: AMapMap) => void
}

export interface AMapOverlay {
  setMap(map: AMapMap | null): void
}

export interface AMapMapEvent {
  lnglat: { lng: number; lat: number }
}

export interface AMapGeocodeResult {
  regeocode?: { formattedAddress?: string }
}

/** The slice of AMap's Geocoder plugin this app calls. */
export interface AMapGeocoder {
  getAddress(
    lnglat: [number, number],
    callback: (status: string, result: AMapGeocodeResult) => void,
  ): void
}

export interface AMapMap {
  on(event: 'click', handler: (event: AMapMapEvent) => void): void
  addControl(control: AMapControl): void
  add(overlays: AMapOverlay | AMapOverlay[]): void
  remove(overlays: AMapOverlay | AMapOverlay[]): void
  setCenter(center: [number, number]): void
  setFitView(overlays?: AMapOverlay[], immediately?: boolean, padding?: number[]): void
  destroy(): void
}

interface AMapConstructorOptions {
  center?: [number, number]
  zoom?: number
  viewMode?: '2D' | '3D'
  resizeEnable?: boolean
}

interface AMapMarkerOptions {
  position: [number, number]
  title?: string
  /** Inline HTML marker content; overrides the default pin when present. */
  content?: string
  /** Pixel offset for custom content, [x, y] from top-left. */
  offset?: [number, number]
}

interface AMapCircleOptions {
  center: [number, number]
  radius: number
  strokeColor: string
  strokeWeight: number
  fillColor: string
  fillOpacity: number
}

interface AMapLineOptions {
  path: [number, number][]
  strokeColor: string
  strokeWeight: number
  strokeOpacity: number
  lineJoin: 'round'
  lineCap: 'round'
}

export interface AMapApi {
  Map: new (container: HTMLElement, options: AMapConstructorOptions) => AMapMap
  Marker: new (options: AMapMarkerOptions) => AMapOverlay
  Circle: new (options: AMapCircleOptions) => AMapOverlay
  Polyline: new (options: AMapLineOptions) => AMapOverlay
  Scale: new () => AMapControl
  ToolBar: new (options?: { position?: string }) => AMapControl
  Geocoder: new (options?: { radius?: number }) => AMapGeocoder
}

const amapInstance = shallowRef<AMapApi | null>(null)
let loadingPromise: Promise<AMapApi> | null = null

/**
 * Loads AMap once for all device-management map pages and keeps the SDK
 * instance opaque so Vue does not proxy the external map implementation.
 */
export function useAMap() {
  async function loadAMap(): Promise<AMapApi> {
    if (amapInstance.value) return amapInstance.value
    if (loadingPromise) return loadingPromise

    const key = import.meta.env.VITE_AMAP_KEY
    const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE
    if (!key || !securityCode) throw new Error('AMap key is not configured')

    window._AMapSecurityConfig = { securityJsCode: securityCode }
    loadingPromise = loadAMapSdk({
      key,
      version: '2.0',
      plugins: ['AMap.Scale', 'AMap.ToolBar', 'AMap.Geocoder'],
    })
      .then((amap) => {
        // SAFETY: the loader resolves the documented AMap JSAPI constructor namespace.
        amapInstance.value = amap as AMapApi
        return amapInstance.value
      })
      .finally(() => {
        loadingPromise = null
      })

    return loadingPromise
  }

  /**
   * Resolves a point to a street address through AMap's Geocoder plugin. The
   * fence stores coordinates only, so the address is display sugar: the caller
   * keeps the coordinates when the lookup fails (offline, plugin unavailable).
   */
  async function reverseGeocode(point: AMapPoint): Promise<string> {
    const amap = await loadAMap()
    const geocoder = new amap.Geocoder({ radius: 500 })
    return new Promise((resolve, reject) => {
      geocoder.getAddress([point.lng, point.lat], (status, result) => {
        const address = result?.regeocode?.formattedAddress
        if (status === 'complete' && address) resolve(address)
        else reject(new Error(`Reverse geocode failed: ${status}`))
      })
    })
  }

  return {
    isLoaded: computed(() => amapInstance.value !== null),
    loadAMap,
    reverseGeocode,
  }
}

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode: string
    }
  }
}
