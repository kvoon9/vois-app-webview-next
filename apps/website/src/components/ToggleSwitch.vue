<script setup lang="ts">
/**
 * Presentational switch for device settings rows. The parent owns the value and
 * the request, so the control only reports a press through `change`.
 */
const props = defineProps<{
  checked: boolean
  disabled?: boolean
  /** Accessible name; the visible label sits in the surrounding row. */
  ariaLabel: string
}>()

const emit = defineEmits<{ change: [] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    class="relative h-7 w-12 flex-none rounded-full disabled:opacity-50"
    :class="props.checked ? 'bg-primary' : 'bg-fill'"
    :aria-checked="props.checked"
    :disabled="props.disabled"
    :aria-label="props.ariaLabel"
    @click="emit('change')"
  >
    <span
      class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
      :class="props.checked ? 'right-0.5' : 'left-0.5'"
    />
  </button>
</template>
