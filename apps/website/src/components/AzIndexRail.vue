<script setup lang="ts">
defineProps<{
  /** Letters shown top to bottom. */
  letters: readonly string[]
  label: string
}>()

const emit = defineEmits<{ select: [letter: string] }>()
</script>

<template>
  <!-- Absolute so it spans the list block and never the search field or the CTA. -->
  <nav class="absolute inset-y-0 right-0 flex flex-col items-center" :aria-label="label">
    <button
      v-for="letter in letters"
      :key="letter"
      type="button"
      class="min-h-0 w-5 flex-1 flex items-center justify-center text-[10px] leading-none text-text-secondary"
      @click="emit('select', letter)"
    >
      {{ letter }}
    </button>
  </nav>
</template>
