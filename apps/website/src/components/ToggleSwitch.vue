<script setup lang="ts">
import { Switch, SwitchThumb } from '@ui-sdk/vue/switch'

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

// Controlled: the SDK reports the press, and the parent decides the value.
function reportPress(): void {
  emit('change')
}
</script>

<template>
  <Switch
    :checked="props.checked"
    :disabled="props.disabled"
    :aria-label="props.ariaLabel"
    class="relative h-7 w-12 flex-none rounded-full disabled:opacity-50"
    :class="props.checked ? 'bg-primary' : 'bg-fill'"
    @checked-change="reportPress"
  >
    <SwitchThumb
      class="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
      :class="props.checked ? 'translate-x-5' : 'translate-x-0'"
    />
  </Switch>
</template>
