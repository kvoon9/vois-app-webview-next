<script lang="ts">
export type TagTone = 'neutral' | 'success' | 'warning' | 'danger'
</script>

<script setup lang="ts">
withDefaults(defineProps<{ label: string; tone?: TagTone }>(), { tone: 'neutral' })

/** Tone → fill and text pair; every pair has a light and a dark value. */
const TONE_CLASS = {
  neutral: 'bg-surface-muted text-text-secondary',
  success: 'bg-surface-online text-status-online',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-soft-text)]',
  danger: 'bg-danger-soft text-danger-soft-text',
} satisfies Record<TagTone, string>
</script>

<template>
  <span
    class="inline-flex items-center whitespace-nowrap rounded-small px-2 py-0.5 text-small font-medium"
    :class="TONE_CLASS[tone]"
  >
    {{ label }}
  </span>
</template>
