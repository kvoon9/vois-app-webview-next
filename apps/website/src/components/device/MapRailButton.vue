<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  icon: string
  label: string
  ariaLabel?: string
  to?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="h-14 w-14 flex flex-col items-center justify-center rounded-xl bg-surface-elevated shadow-lg disabled:opacity-60"
    :aria-label="ariaLabel ?? label"
  >
    <span :class="[icon, 'text-2xl text-text-primary']" aria-hidden="true" />
    <span class="mt-0.5 text-small leading-none text-text-primary">{{ label }}</span>
  </RouterLink>
  <button
    v-else
    type="button"
    class="h-14 w-14 flex flex-col items-center justify-center rounded-xl bg-surface-elevated shadow-lg disabled:opacity-60"
    :aria-label="ariaLabel ?? label"
    :disabled="disabled"
    @click="emit('click')"
  >
    <span :class="[icon, 'text-2xl text-text-primary']" aria-hidden="true" />
    <span class="mt-0.5 text-small leading-none text-text-primary">{{ label }}</span>
  </button>
</template>
