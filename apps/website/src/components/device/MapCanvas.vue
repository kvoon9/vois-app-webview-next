<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useAMap,
  type AMapApi,
  type AMapMap,
  type AMapOverlay,
  type AMapPoint,
} from '~/composables/useAMap'
import bearingUrl from '~/assets/map/icon_user_share_location_bearing.png'
import ringUrl from '~/assets/map/icon_user_share_location_circle.png'
import devicePinUrl from '~/assets/map/ic_location_marker.png'
import type { DeviceFence } from '~/utils/device-api'

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
  track?: AMapPoint[]
  /** Let the map report taps, for picking a fence centre. */
  picker?: boolean
}>()

const emit = defineEmits<{
  pick: [point: AMapPoint]
}>()

const { t } = useI18n({ useScope: 'global' })
const { loadAMap } = useAMap()
const container = useTemplateRef<HTMLDivElement>('container')
const map = shallowRef<AMapMap | null>(null)
const amap = shallowRef<AMapApi | null>(null)
const overlays = shallowRef<AMapOverlay[]>([])
const error = shallowRef<string | null>(null)

function pointValue(point: AMapPoint): [number, number] {
  return [point.lng, point.lat]
}

/** Native renders the position marker as its MapUserAvatar view: a blue
 * bearing droplet (63dp) behind a white ring (40.5dp) and a 36dp round avatar,
 * all concentric at the anchor. The avatar sits on the ring; the droplet body
 * shows around it and the tail points up. */
function deviceMarkerContent(): string {
  const avatar = props.markerAvatar?.replace(/"/g, '%22')
  const inner = avatar
    ? `<img src="${avatar}" alt="" style="position:absolute;inset:0;width:36px;height:36px;border-radius:50%;object-fit:cover">`
    : `<span style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1;color:#6b7280;background:#fff">${
        props.markerName?.trim().slice(0, 1) || '?'
      }</span>`
  return (
    `<div style="position:relative;width:63px;height:63px">` +
    `<img src="${bearingUrl}" alt="" style="position:absolute;inset:0;width:63px;height:63px">` +
    `<img src="${ringUrl}" alt="" style="position:absolute;left:11.25px;top:11.75px;width:40.5px;height:39.5px">` +
    `<span style="position:absolute;left:13.5px;top:13.5px;width:36px;height:36px;border-radius:50%;overflow:hidden">${inner}</span>` +
    `</div>`
  )
}

function removeOverlays(): void {
  if (map.value && overlays.value.length > 0) map.value.remove(overlays.value)
  overlays.value = []
}

function drawOverlays(): void {
  if (!map.value || !amap.value) return
  removeOverlays()
  map.value.setCenter(pointValue(props.center))

  const nextOverlays: AMapOverlay[] = []
  if (props.marker) {
    nextOverlays.push(
      new amap.value.Marker({
        position: pointValue(props.marker),
        title: t('device.deviceLocation'),
        content: deviceMarkerContent(),
        // Native anchors the marker view at its centre (anchor 0.5, 0.5).
        offset: [-31.5, -31.5],
      }),
    )
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
  // Native paints the fence pure green over an 8% black fill and draws no
  // centre marker on the viewer page, just the disc.
  if (props.fence) {
    nextOverlays.push(
      new amap.value.Circle({
        center: pointValue(props.fence),
        radius: props.fence.radius,
        strokeColor: '#00FF00',
        strokeWeight: 5,
        fillColor: 'rgba(0,0,0,0.08)',
      }),
    )
    // Only the editor carries a centre marker: native's fence editor pins
    // the centre with the red location pin, centre-anchored.
    if (props.picker) {
      nextOverlays.push(
        new amap.value.Marker({
          position: pointValue(props.fence),
          title: t('device.fenceCenter'),
          content: `<img src="${devicePinUrl}" alt="" style="width:53px;height:53px">`,
          offset: [-26.5, -26.5],
        }),
      )
    }
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

  overlays.value = nextOverlays
  if (nextOverlays.length > 0) map.value.add(nextOverlays)
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
    })
    map.value.addControl(new amap.value.Scale())
    // Native keeps zoom bottom-right (the scale and logo own bottom-left) and
    // leaves the top corners to the compass and the page's own buttons.
    map.value.addControl(new amap.value.ToolBar({ position: 'RB' }))
    if (props.picker) {
      map.value.on('click', (event) =>
        emit('pick', { lng: event.lnglat.lng, lat: event.lnglat.lat }),
      )
    }
    drawOverlays()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
})

watch(
  () => [props.center, props.marker, props.markerAvatar, props.fence, props.track],
  () => drawOverlays(),
  { deep: true },
)

onUnmounted(() => {
  removeOverlays()
  map.value?.destroy()
  map.value = null
})
</script>

<template>
  <div class="relative h-full min-h-80 w-full overflow-hidden bg-surface-muted">
    <div ref="container" class="h-full min-h-80 w-full" />
    <div
      v-if="error"
      class="absolute inset-0 flex items-center justify-center bg-surface-muted/90 p-8 text-center text-body text-text-secondary"
    >
      {{ t('device.mapUnavailable') }}
    </div>
  </div>
</template>
