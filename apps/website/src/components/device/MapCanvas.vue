<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useAMap,
  type AMapApi,
  type AMapMap,
  type AMapMarker,
  type AMapOverlay,
  type AMapPoint,
} from '~/composables/useAMap'
import bearingUrl from '~/assets/map/icon_user_share_location_bearing.png'
import ringUrl from '~/assets/map/icon_user_share_location_circle.png'
import devicePinUrl from '~/assets/map/ic_location_marker.png'
import compassUrl from '~/assets/map/ic_compass.png'
import myLocationUrl from '~/assets/map/ic_my_location.png'
import type { DeviceFence } from '~/utils/device-api'
import type { TrackMapPoint } from '~/utils/track'

const props = defineProps<{
  center: AMapPoint
  marker?: AMapPoint | null
  /** The device's avatar, drawn inside the location pin's white window. */
  markerAvatar?: string | null
  /** The device's nick; its initial stands in when there is no avatar. */
  markerName?: string
  /** The viewer's own position (bridge GPS), drawn as the my-location dot. */
  me?: AMapPoint | null
  fence?: DeviceFence | null
  /** The confirmed centre a pending pick would replace; drawn dimmed. */
  fenceFrom?: AMapPoint | null
  /** The pending centre the anchor popup points at. */
  anchor?: AMapPoint | null
  track?: TrackMapPoint[]
  /** The point whose detail card is open; only its marker switches to primary. */
  selectedTrackIndex?: number | null
  /** Replace with a new point object to pan the map there. */
  focus?: AMapPoint | null
  /** Let the map report taps, for picking a fence centre. */
  picker?: boolean
}>()

const emit = defineEmits<{
  pick: [point: AMapPoint]
  'select-track-point': [index: number]
  'device-marker-click': []
}>()

const { t } = useI18n({ useScope: 'global' })
const { loadAMap } = useAMap()
const container = useTemplateRef<HTMLDivElement>('container')
const map = shallowRef<AMapMap | null>(null)
const amap = shallowRef<AMapApi | null>(null)
const overlays = shallowRef<AMapOverlay[]>([])
let trackMarkerOverlays: AMapMarker[] = []
let lastSelectedIndex: number | null = null
const error = shallowRef<string | null>(null)
/** The fence id the camera already framed; refits only when a new one loads. */
const fittedFenceId = shallowRef<number | null>(null)
let fenceCircleForFit: AMapOverlay | null = null
/**
 * Fit padding in AMap's avoid order [top, bottom, left, right], which is not
 * CSS's [top, right, bottom, left]; setFitView silently misreads CSS order,
 * which once put the editor's fence under its bottom sheet. Viewer values
 * clear the status pill at the top and the fence warning / locate-me controls
 * at the bottom.
 */
const VIEWER_FIT_AVOID = [80, 120, 80, 80]
/** Editor fit padding [top, bottom, left, right]; clears the fence editor's
 * radius strip overlaying the map top. */
const EDITOR_FIT_AVOID: [number, number, number, number] = [80, 40, 40, 40]
/** The radius strip covers the map top; a pick centres the point in the band
 * below it so the pin and its card stay clear of the strip. */
const EDITOR_PICK_PAN = 32
/** The fence geometry the editor camera last framed; plain state like
 * fenceCircleForFit. Save and delete leave via goBack and unmount the page,
 * so it dies with the component. A refactor that keeps the map mounted
 * across saves must reset it, or the gate would skip the next entry's fit. */
let lastFitted: { lng: number; lat: number; radius: number } | null = null

/** The anchor marker's container pixel and the side its card sits on. */
const anchorPosition = shallowRef<{
  left: number
  top: number
  side: 'left' | 'right'
} | null>(null)

function pointValue(point: AMapPoint): [number, number] {
  return [point.lng, point.lat]
}

/** Projection only answers after the map exists; recompute on every camera move. */
function updateAnchorPosition(): void {
  const mapValue = map.value
  const point = props.anchor
  const element = container.value
  if (!mapValue || !point || !element) {
    anchorPosition.value = null
    return
  }
  const pixel = mapValue.lngLatToContainer(pointValue(point))
  const x = pixel.getX()
  const y = pixel.getY()
  const width = element.clientWidth
  const height = element.clientHeight
  const fitsRight = x + 36 + 120 <= width
  // The wrapper is centred on `top` (`translateY(-50%)`), so both bounds are
  // padded by half the 72px card: keep it below the 64px radius strip and
  // inside the map.
  const cardHalfHeight = 36
  anchorPosition.value = {
    left: fitsRight ? x + 36 : x - 36,
    top: Math.min(Math.max(y - 28, 64 + 8 + cardHalfHeight), height - 8 - cardHalfHeight),
    side: fitsRight ? 'right' : 'left',
  }
}

const anchorStyle = computed(() => {
  const position = anchorPosition.value
  if (!position) return undefined
  return {
    left: `${position.left}px`,
    top: `${position.top}px`,
    transform: position.side === 'left' ? 'translate(-100%, -50%)' : 'translateY(-50%)',
  }
})

/** Native renders the position marker as its MapUserAvatar view: a blue
 * bearing droplet (63dp) behind a white ring (40.5dp) and a 36dp round avatar,
 * all concentric at the anchor. The avatar sits on the ring; the droplet body
 * shows around it and the tail points up. */
function deviceMarkerContent(): HTMLElement {
  const root = document.createElement('div')
  root.style.cssText = 'position:relative;width:63px;height:63px'
  root.innerHTML =
    `<img src="${bearingUrl}" alt="" style="position:absolute;inset:0;width:63px;height:63px">` +
    `<img src="${ringUrl}" alt="" style="position:absolute;left:11.25px;top:11.75px;width:40.5px;height:39.5px">`
  const well = document.createElement('span')
  well.style.cssText =
    'position:absolute;left:13.5px;top:13.5px;width:36px;height:36px;border-radius:50%;overflow:hidden'
  const fallback = document.createElement('span')
  fallback.style.cssText =
    'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1;color:#6b7280;background:#fff'
  fallback.textContent = props.markerName?.trim().slice(0, 1) || '?'
  well.append(fallback)

  const avatar = props.markerAvatar
  if (avatar) {
    const image = document.createElement('img')
    image.alt = ''
    image.style.cssText =
      'position:absolute;inset:0;width:36px;height:36px;border-radius:50%;object-fit:cover;opacity:0;transition:opacity 150ms'
    image.addEventListener('load', () => {
      image.style.opacity = '1'
    })
    image.addEventListener('error', () => {
      image.remove()
    })
    image.src = avatar
    well.append(image)
  }

  root.append(well)
  return root
}

/** Inline styles only: AMap injects this DOM outside Vue's scoped-style scope. */
function markerContent(index: number, selected: boolean): string {
  const dot = selected
    ? 'width:20px;height:20px;background:var(--color-primary);box-shadow:0 0 0 3px #fff'
    : 'width:12px;height:12px;background:#fff;box-shadow:0 0 0 2px var(--color-text-secondary)'
  return (
    `<div data-track-index="${index}" style="width:36px;height:36px;display:flex;align-items:center;justify-content:center">` +
    `<span style="display:block;border-radius:50%;${dot}"></span>` +
    `</div>`
  )
}

function removeOverlays(): void {
  if (map.value && overlays.value.length > 0) map.value.remove(overlays.value)
  overlays.value = []
  trackMarkerOverlays = []
}

/** The centre the camera was last pointed at. A later draw whose centre has
 * not changed must not re-setCenter: the jump cancels an in-flight entry
 * fit's avoid shift and re-frames the fence. */
let centeredPoint: AMapPoint | null = null

function drawOverlays(): void {
  if (!map.value || !amap.value) return
  removeOverlays()
  const center = props.center
  if (!centeredPoint || centeredPoint.lng !== center.lng || centeredPoint.lat !== center.lat) {
    centeredPoint = { lng: center.lng, lat: center.lat }
    map.value.setCenter(pointValue(center))
    if (props.picker && lastFitted) {
      map.value.panBy(0, EDITOR_PICK_PAN, 0)
    }
  }
  fenceCircleForFit = null

  const nextOverlays: AMapOverlay[] = []
  if (props.marker) {
    const marker = new amap.value.Marker({
      position: pointValue(props.marker),
      title: t('device.deviceLocation'),
      content: deviceMarkerContent(),
      // Native anchors the marker view at its centre (anchor 0.5, 0.5).
      offset: [-31.5, -31.5],
    })
    marker.on('click', () => emit('device-marker-click'))
    nextOverlays.push(marker)
  }
  if (props.me) {
    nextOverlays.push(
      new amap.value.Marker({
        position: pointValue(props.me),
        title: t('device.myLocation'),
        // Native shows the viewer through AMap's built-in my-location blue
        // dot; the web stand-in is the same small dot with a white ring.
        content:
          '<div style="width:14px;height:14px;border-radius:50%;background:#2f7bf6;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>',
        offset: [-10, -10],
      }),
    )
  }
  // A pending pick keeps the confirmed centre in view: dimmed pin plus a
  // dashed line to the preview circle.
  if (props.fenceFrom) {
    if (props.fence) {
      nextOverlays.push(
        new amap.value.Polyline({
          path: [pointValue(props.fenceFrom), pointValue(props.fence)],
          strokeColor: '#6b6b6c',
          strokeWeight: 2,
          strokeOpacity: 1,
          lineJoin: 'round',
          lineCap: 'round',
          strokeStyle: 'dashed',
          strokeDasharray: [6, 6],
        }),
      )
    }
    nextOverlays.push(
      new amap.value.Marker({
        position: pointValue(props.fenceFrom),
        content: `<img src="${devicePinUrl}" alt="" style="width:36px;height:36px;opacity:0.55">`,
        offset: [-18, -36],
        // The editor promises a pick anywhere; a pin must not be a dead spot.
        bubble: true,
      }),
    )
  }
  // Native paints the fence pure green over an 8% black fill and draws no
  // centre marker on the viewer page, just the disc.
  if (props.fence) {
    const fenceCircle = new amap.value.Circle({
      center: pointValue(props.fence),
      radius: props.fence.radius,
      strokeColor: '#00FF00',
      // Native's 5 physical px ≈ 2 css px on a 2.75x phone screen.
      strokeWeight: 2,
      fillColor: '#000000',
      fillOpacity: 0.08,
      // The editor picks the centre anywhere on the map; without bubble the
      // circle swallows clicks inside the disc.
      bubble: true,
    })
    nextOverlays.push(fenceCircle)
    // Only the editor carries a centre marker: native's fence editor pins
    // the centre with the red location pin. The needle tip anchors the point
    // (the pin is 53px, tip 2px above its bottom edge) so the needle touches
    // the picked spot instead of floating over it.
    if (props.picker) {
      nextOverlays.push(
        new amap.value.Marker({
          position: pointValue(props.fence),
          title: t('device.fenceCenter'),
          content: `<img src="${devicePinUrl}" alt="" style="width:53px;height:53px">`,
          offset: [-26.5, -51],
          bubble: true,
        }),
      )
    }
    fenceCircleForFit = fenceCircle
  }
  if (props.track && props.track.length > 1) {
    nextOverlays.push(
      new amap.value.Polyline({
        path: props.track.map(pointValue),
        // Native's track line is the same pure green as the fence.
        strokeColor: '#00FF00',
        strokeWeight: 5,
        strokeOpacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round',
      }),
    )
  }
  if (props.track) {
    const selected = props.selectedTrackIndex ?? null
    for (let index = 0; index < props.track.length; index++) {
      const point = props.track[index]!
      const isSelected = index === selected
      const trackMarker = new amap.value.Marker({
        position: pointValue(point),
        title: point.time,
        content: markerContent(index, isSelected),
        offset: [-18, -18],
        zIndex: isSelected ? 120 : 110,
      })
      trackMarker.on('click', () => emit('select-track-point', index))
      trackMarkerOverlays.push(trackMarker)
      nextOverlays.push(trackMarker)
    }
    lastSelectedIndex = selected
  }

  overlays.value = nextOverlays
  if (nextOverlays.length > 0) map.value.add(nextOverlays)
  updateAnchorPosition()

  // Native frames the fence on entry. The viewer gates on fence id so user
  // panning stays put; the editor gates on geometry, since its preview id is
  // constant (0 for a new fence) while geometry is what changes.
  if (!props.fence || !fenceCircleForFit) return
  if (!props.picker) {
    if (props.fence.id !== fittedFenceId.value) {
      fittedFenceId.value = props.fence.id
      map.value.setFitView([fenceCircleForFit], false, VIEWER_FIT_AVOID)
    }
    return
  }
  // Name is outside the gate: typing it must not move the camera. A
  // centre-only change does not refit either: the setCenter follow above
  // already moves the camera, so the user's manual zoom survives precise
  // placement. A radius change snaps so a slider drag cannot queue
  // overlapping setFitView animations.
  const fitted = lastFitted
  if (fitted && fitted.radius === props.fence.radius) return
  lastFitted = {
    lng: props.fence.lng,
    lat: props.fence.lat,
    radius: props.fence.radius,
  }
  map.value.setFitView([fenceCircleForFit], fitted != null, EDITOR_FIT_AVOID)
}

onMounted(async () => {
  try {
    amap.value = await loadAMap()
    if (!container.value || !amap.value) return
    map.value = new amap.value.Map(container.value, {
      center: pointValue(props.center),
      zoom: 14,
      viewMode: '2D',
      resizeEnable: true,
      // Native ships a desaturated light map style; whitesmoke is the
      // closest built-in AMap style (grey renders dark).
      mapStyle: 'amap://styles/whitesmoke',
    })
    map.value.addControl(new amap.value.Scale())
    if (props.picker) {
      map.value.on('click', (event) =>
        emit('pick', { lng: event.lnglat.lng, lat: event.lnglat.lat }),
      )
      map.value.on('mapmove', updateAnchorPosition)
      map.value.on('zoomchange', updateAnchorPosition)
    }
    drawOverlays()
    if (props.focus) map.value?.setCenter(pointValue(props.focus))
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
})

function centerOnMe(): void {
  if (map.value && props.me) map.value.setCenter(pointValue(props.me))
}

function zoomIn(): void {
  map.value?.zoomIn()
}

function zoomOut(): void {
  map.value?.zoomOut()
}

watch(
  () => [
    props.center,
    props.marker,
    props.markerAvatar,
    props.markerName,
    props.fence,
    props.fenceFrom,
    props.track,
  ],
  () => drawOverlays(),
  { deep: true },
)

watch(
  () => props.anchor,
  () => updateAnchorPosition(),
)

watch(
  () => props.selectedTrackIndex,
  (next) => {
    const previous = lastSelectedIndex
    lastSelectedIndex = next ?? null
    if (previous != null) {
      trackMarkerOverlays[previous]?.setContent(markerContent(previous, false))
      trackMarkerOverlays[previous]?.setOptions({ zIndex: 110 })
    }
    if (next != null) {
      trackMarkerOverlays[next]?.setContent(markerContent(next, true))
      trackMarkerOverlays[next]?.setOptions({ zIndex: 120 })
    }
  },
)

watch(
  () => props.focus,
  (focus) => {
    if (focus && map.value) map.value.setCenter(pointValue(focus))
  },
)

onUnmounted(() => {
  removeOverlays()
  map.value?.destroy()
  map.value = null
})
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-surface-muted">
    <div ref="container" class="h-full w-full" />

    <div v-if="anchor && anchorStyle" class="absolute z-20" :style="anchorStyle">
      <slot name="anchor-popup" />
    </div>

    <!-- Native map chrome: compass top-left, locate-me bottom-left above the
         scale, zoom bottom-right. The page's own buttons stack over these. -->
    <img
      :src="compassUrl"
      alt=""
      aria-hidden="true"
      class="left-4 top-4 h-10 w-10 absolute drop-shadow"
    />
    <button
      type="button"
      class="bottom-20 left-4 h-12 w-12 absolute flex items-center justify-center rounded-xl bg-surface-elevated shadow-lg"
      :aria-label="t('device.myLocation')"
      @click="centerOnMe"
    >
      <img :src="myLocationUrl" alt="" class="h-6 w-6" />
    </button>
    <div class="bottom-4 right-4 absolute flex flex-col space-y-1.5">
      <button
        type="button"
        class="h-11 w-11 flex items-center justify-center rounded-lg border border-fill bg-surface-elevated text-header text-text-primary shadow-sm"
        aria-label="+"
        @click="zoomIn"
      >
        <span class="i-ph-plus-bold text-xl" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="h-11 w-11 flex items-center justify-center rounded-lg border border-fill bg-surface-elevated text-header text-text-primary shadow-sm"
        aria-label="-"
        @click="zoomOut"
      >
        <span class="i-ph-minus-bold text-xl" aria-hidden="true" />
      </button>
    </div>

    <div
      v-if="error"
      class="absolute inset-0 flex items-center justify-center bg-surface-muted/90 p-8 text-center text-body text-text-secondary"
    >
      {{ t('device.mapUnavailable') }}
    </div>
  </div>
</template>
