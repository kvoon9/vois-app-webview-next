<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from '@ui-sdk/vue/avatar'
import { computed } from 'vue'

type AvatarSize = 'sm' | 'md' | 'profile' | 'lg' | 'xl' | '2xl'

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
  /** Native's device-detail avatar is 56dp, between `md` and `lg`. */
  profile: 'h-14 w-14 text-subtitle',
  lg: 'h-16 w-16 text-title',
  xl: 'h-20 w-20 text-2xl',
  '2xl': 'h-24 w-24 text-3xl',
} satisfies Record<AvatarSize, string>

const initial = computed(() => props.name.trim().slice(0, 1) || '?')
</script>

<template>
  <Avatar
    class="relative flex flex-none items-center justify-center overflow-hidden rounded-full bg-surface-muted text-text-secondary"
    :class="SIZE_CLASS[size]"
  >
    <AvatarImage
      v-if="src"
      :src="src"
      :alt="alt"
      class="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
    />
    <AvatarFallback v-slot="{ state }">
      <!-- A src that has not bound its image yet is still in flight, so it gets the spinner. -->
      <span
        v-if="state.loadingStatus === 'loading' || (state.loadingStatus === 'idle' && src)"
        class="i-ph-spinner animate-spin"
        aria-hidden="true"
      />
      <template v-else>{{ initial }}</template>
    </AvatarFallback>
    <span
      v-if="showStatus && online !== undefined"
      class="status-dot"
      :class="online ? 'bg-blue-500' : 'bg-fill'"
      :aria-label="statusLabel"
      :role="statusLabel ? 'img' : undefined"
    />
  </Avatar>
</template>
