<script setup lang="ts">
import { useDark } from '@vueuse/core'
import { shallowRef, onErrorCaptured } from 'vue'
import { RouterView } from 'vue-router'

useDark()

const error = shallowRef<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err))
  // ponytail: stop propagation so global errorHandler doesn't double-handle
  return false
})
</script>

<template>
  <div
    v-if="error"
    class="min-h-svh flex flex-col items-center justify-center p-8 bg-surface text-text-primary"
  >
    <h1 class="text-lg font-bold mb-2">Something went wrong</h1>
    <p class="text-body text-text-secondary text-center mb-6">
      An unexpected error occurred. Please try again.
    </p>
    <button type="button" class="btn-primary" @click="error = null">Try again</button>
  </div>
  <RouterView v-else />
</template>

<style>
html {
  color-scheme: light dark;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  color-scheme: light dark;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
