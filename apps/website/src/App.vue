<script setup lang="ts">
import { useDark, usePreferredDark } from '@vueuse/core'
import { useRouteQuery } from '@vueuse/router'
import { onErrorCaptured, shallowRef, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useLangQuery } from '~/composables/useLangQuery'

const isDark = useDark({ storageKey: null })
const prefersDark = usePreferredDark()
const theme = useRouteQuery('theme')

watch(
  [theme, prefersDark],
  ([value, systemIsDark]) => {
    isDark.value = value === 'dark' || (value !== 'light' && systemIsDark)
  },
  { immediate: true },
)
useLangQuery()

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
    <h1 class="text-lg font-bold mb-2">{{ $t('error.title') }}</h1>
    <p class="text-body text-text-secondary text-center mb-6">
      {{ $t('error.description') }}
    </p>
    <button type="button" class="btn-primary" @click="error = null">{{ $t('error.retry') }}</button>
  </div>
  <RouterView v-else />
</template>

<style>
html {
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
