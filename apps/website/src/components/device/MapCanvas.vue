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
import locationIconUrl from '~/assets/map/ic_location.png'
import selectPinUrl from '~/assets/map/ic_location_select.png'
import devicePinUrl from '~/assets/map/ic_location_marker.png'
import type { DeviceFence } from '~/utils/device-api'

const props = defineProps<{
  center: AMapPoint
  marker?: AMapPoint | null
  /** The device's avatar, drawn inside the location pin's white window. */
  markerAvatar?: string | null
  /** The device's nick; its initial stands in when there is no avatar. */
  markerName?: string
  /** The viewer's own position (bridge GPS), drawn as the blue droplet. */
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

/** ic_location_marker.png is a 2x asset: 106px asset, 53px on screen. The pin
 * ships with the white avatar window baked in at (19, 14), 15px across. */
function deviceMarkerContent(): string {
  const avatar = props.markerAvatar?.replace(/"/g, '%22')
  const inner = avatar
    ? `<img src="${avatar}" alt="" style="position:absolute;inset:0;width:15px;height:15px;border-radius:50%;object-fit:cover">`
    : `<span style="width:15px;height:15px;display:flex;align-items:center;justify-content:center;font-size:9px;line-height:1;color:#6b7280">${
        props.markerName?.trim().slice(0, 1) || '?'
      }</span>`
  return (
    `<div style="position:relative;width:53px;height:53px">` +
    `<img src="${devicePinUrl}" alt="" style="position:absolute;inset:0;width:53px;height:53px">` +
    `<span style="position:absolute;left:19px;top:14px;width:15px;height:15px;border-radius:50%;overflow:hidden">${inner}</span>` +
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
        offset: [-26.5, -51],
      }),
    )
  }
  if (props.me) {
    nextOverlays.push(
      new amap.value.Marker({
        position: pointValue(props.me),
        title: t('device.myLocation'),
        // Native's blue droplet: the round body sits on the fix, the tail
        // points away; the body centre is at (17.25, 20.25) of a 32px draw.
        content: `<img src="${locationIconUrl}" alt="" style="width:32px;height:32px">`,
        offset: [-17.25, -20.25],
      }),
    )
  }
  if (props.fence) {
    nextOverlays.push(
      new amap.value.Circle({
        center: pointValue(props.fence),
        radius: props.fence.radius,
        // The fence reads as a translucent green disc on the map (native draws
        // one); the H5 brand green replaces native's pure #00FF00 stroke.
        strokeColor: '#16c784',
        strokeWeight: 2,
        fillColor: '#16c784',
        fillOpacity: 0.15,
      }),
    )
    // The centre carries native's red pick balloon, the same one the editor
    // uses; a bare disc has no visible anchor.
    nextOverlays.push(
      new amap.value.Marker({
        position: pointValue(props.fence),
        title: t('device.fenceCenter'),
        content: `<img src="${selectPinUrl}" alt="" style="width:21px;height:44px">`,
        offset: [-10.5, -44],
      }),
    )
  }
  if (props.track && props.track.length > 1) {
    nextOverlays.push(
      new amap.value.Polyline({
        path: props.track.map(pointValue),
        strokeColor: '#16c784',
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
