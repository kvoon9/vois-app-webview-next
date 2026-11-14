<script setup lang="ts">
defineProps<{
  /** Letters shown top to bottom. */
  letters: readonly string[]
  label: string
}>()

const emit = defineEmits<{ select: [letter: string] }>()
</script>

<template>
  <nav
    class="fixed right-4 top-[46%] z-10 -translate-y-1/2 flex flex-col items-center"
    :aria-label="label"
  >
    <button
      v-for="letter in letters"
      :key="letter"
      type="button"
      class="h-[15px] w-5 flex items-center justify-center text-[10px] leading-none text-text-secondary"
      @click="emit('select', letter)"
    >
      {{ letter }}
    </button>
  </nav>
</template>
