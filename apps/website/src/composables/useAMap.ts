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

export interface AMapMap {
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
  ToolBar: new () => AMapControl
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
      plugins: ['AMap.Scale', 'AMap.ToolBar'],
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

  return {
    isLoaded: computed(() => amapInstance.value !== null),
    loadAMap,
  }
}

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode: string
    }
  }
}
