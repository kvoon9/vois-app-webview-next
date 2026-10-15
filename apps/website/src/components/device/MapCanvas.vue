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
import type { DeviceFence } from '~/utils/device-api'

const props = defineProps<{
  center: AMapPoint
  marker?: AMapPoint | null
  /** The viewer's own position (bridge GPS), drawn as a distinct blue dot. */
  me?: AMapPoint | null
  fence?: DeviceFence | null
  track?: AMapPoint[]
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
      }),
    )
  }
  if (props.me) {
    nextOverlays.push(
      new amap.value.Marker({
        position: pointValue(props.me),
        title: t('device.myLocation'),
        // A small blue dot so the viewer's position reads differently from the
        // device's default pin; AMap accepts inline HTML as marker content.
        content:
          '<div style="width:14px;height:14px;border-radius:50%;background:#2f7bf6;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>',
        offset: [-7, -7],
      }),
    )
  }
  if (props.fence) {
    nextOverlays.push(
      new amap.value.Circle({
        center: pointValue(props.fence),
        radius: props.fence.radius,
        strokeColor: '#16c784',
        strokeWeight: 2,
        fillColor: '#83c7d4',
        fillOpacity: 0.22,
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
    map.value.addControl(new amap.value.ToolBar())
    drawOverlays()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
})

watch(
  () => [props.center, props.marker, props.fence, props.track],
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
