<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue'

const props = defineProps<{
  letters: readonly string[]
  label: string
  /** Letters that have at least one matching row; the rest render dimmed. */
  available?: ReadonlySet<string>
}>()

const emit = defineEmits<{ select: [letter: string] }>()

const rail = useTemplateRef<HTMLElement>('rail')
const activeLetter = shallowRef<string | null>(null)
const pointer = shallowRef<{ x: number; y: number } | null>(null)
const dragging = shallowRef(false)

function letterAt(clientY: number): string | null {
  const element = rail.value
  if (!element) return null
  const rect = element.getBoundingClientRect()
  if (rect.height === 0) return null
  const index = Math.floor(((clientY - rect.top) / rect.height) * props.letters.length)
  return props.letters[Math.min(Math.max(index, 0), props.letters.length - 1)] ?? null
}

function isAvailable(letter: string): boolean {
  return props.available?.has(letter) ?? true
}

function track(event: PointerEvent): void {
  const letter = letterAt(event.clientY)
  if (letter) activeLetter.value = letter
  pointer.value = { x: event.clientX, y: event.clientY }
}

function select(letter: string): void {
  if (isAvailable(letter)) emit('select', letter)
}

function onPointerDown(event: PointerEvent): void {
  dragging.value = true
  rail.value?.setPointerCapture(event.pointerId)
  track(event)
}

function onPointerMove(event: PointerEvent): void {
  if (dragging.value) track(event)
}

/** Jump once on release: each jump scrolls the list under the finger mid-drag. */
function onPointerEnd(event: PointerEvent): void {
  if (!dragging.value) return
  dragging.value = false
  if (rail.value?.hasPointerCapture(event.pointerId)) {
    rail.value.releasePointerCapture(event.pointerId)
  }
  if (activeLetter.value && isAvailable(activeLetter.value)) emit('select', activeLetter.value)
  activeLetter.value = null
  pointer.value = null
}
</script>

<template>
  <nav
    ref="rail"
    class="flex touch-none flex-col items-center"
    :aria-label="label"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerEnd"
    @pointercancel="onPointerEnd"
  >
    <button
      v-for="letter in letters"
      :key="letter"
      type="button"
      class="min-h-0 w-5 flex-1 flex items-center justify-center text-[10px] leading-none text-text-secondary transition-opacity"
      :class="isAvailable(letter) ? '' : 'opacity-40'"
      :aria-disabled="!isAvailable(letter)"
      @click="select(letter)"
    >
      {{ letter }}
    </button>
    <div
      v-if="activeLetter && pointer"
      class="pointer-events-none fixed z-20 h-14 w-14 flex items-center justify-center rounded-full bg-surface-muted text-subtitle font-semibold text-text-primary"
      :style="{
        left: `${pointer.x - 12}px`,
        top: `${pointer.y}px`,
        transform: 'translate(-100%, -50%)',
      }"
      role="status"
    >
      <!-- The disc stays solid so the prompt keeps its shape; only the glyph dims. -->
      <span class="transition-opacity" :class="isAvailable(activeLetter) ? '' : 'opacity-40'">
        {{ activeLetter }}
      </span>
    </div>
  </nav>
</template>
