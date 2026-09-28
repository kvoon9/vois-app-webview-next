<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const props = withDefaults(
  defineProps<{
    alt?: string
    name: string
    online?: boolean
    showStatus?: boolean
    size?: AvatarSize
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

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-2nd-body',
  md: 'h-11 w-11 text-header',
  lg: 'h-16 w-16 text-title',
  xl: 'h-20 w-20 text-2xl',
  '2xl': 'h-24 w-24 text-3xl',
} satisfies Record<AvatarSize, string>

const failed = shallowRef(false)
const loaded = shallowRef(false)

// A new src is an unloaded image again; without this, the previous result sticks.
watch(
  () => props.src,
  () => {
    failed.value = false
    loaded.value = false
  },
)

// A remote image in flight is not the avatar yet. Nothing in the slot claims to be
// it: the spinner says "loading" and the initial is reserved for the no-image and
// broken-image cases, so an upload never flashes the old letter back.
const loading = computed(() => Boolean(props.src) && !loaded.value && !failed.value)

const initial = computed(() => props.name.trim().slice(0, 1) || '?')
</script>

<template>
  <span
    class="relative flex flex-none items-center justify-center overflow-hidden rounded-full bg-surface-muted text-text-secondary"
    :class="SIZE_CLASS[size]"
  >
    <span v-if="loading" class="i-ph-spinner animate-spin" aria-hidden="true" />
    <template v-else>{{ initial }}</template>
    <img
      v-if="src && !failed"
      :src="src"
      :alt="alt"
      class="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      @load="loaded = true"
      @error="failed = true"
    />
    <span
      v-if="showStatus && online !== undefined"
      class="status-dot"
      :class="online ? 'bg-blue-500' : 'bg-fill'"
      :aria-label="statusLabel"
      :role="statusLabel ? 'img' : undefined"
    />
  </span>
</template>
