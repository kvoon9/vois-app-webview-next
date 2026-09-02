<script setup lang="ts">
import { computed } from 'vue'
import { hideBrokenImage } from '~/utils/image'

const props = withDefaults(
  defineProps<{
    alt?: string
    name: string
    online?: boolean
    showStatus?: boolean
    size?: 'sm' | 'md' | 'lg'
    src?: string | null
    statusLabel?: string
  }>(),
  {
    alt: '',
    online: undefined,
    showStatus: false,
    size: 'md',
    src: null,
    statusLabel: undefined,
  },
)

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'h-8 w-8 text-2nd-body'
  if (props.size === 'lg') return 'h-16 w-16 text-title'
  return 'h-11 w-11 text-header'
})

const initial = computed(() => props.name.trim().slice(0, 1) || '?')
</script>

<template>
  <span
    class="relative flex flex-none items-center justify-center overflow-hidden rounded-full bg-surface-muted text-text-secondary"
    :class="sizeClass"
  >
    {{ initial }}
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      class="absolute inset-0 h-full w-full object-cover"
      @error="hideBrokenImage"
    />
    <span
      v-if="showStatus && online !== undefined"
      class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface"
      :class="online ? 'bg-blue-500' : 'bg-stroke'"
      :aria-label="statusLabel"
      :role="statusLabel ? 'img' : undefined"
    />
  </span>
</template>
