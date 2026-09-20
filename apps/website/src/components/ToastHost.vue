<script setup lang="ts">
import { useToast } from '~/composables/useToast'

const { dismissToast, toast } = useToast()
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-modal flex justify-center"
    aria-live="polite"
    aria-atomic="true"
  >
    <!-- The toast itself is the dismiss target: no close affordance to aim at. -->
    <button
      v-if="toast"
      :key="toast.id"
      type="button"
      class="pointer-events-auto flex max-w-sm items-center rounded-standard px-4 py-3 text-left text-2nd-body shadow-lg"
      :class="{
        'bg-primary text-primary-text': toast.type === 'success',
        'bg-danger text-danger-text': toast.type === 'error',
        'bg-text-primary text-surface': toast.type === 'info',
      }"
      @click="dismissToast"
    >
      <span class="min-w-0 flex-1">{{ toast.message }}</span>
    </button>
  </div>
</template>
