<script setup lang="ts">
import { useDark } from '@vueuse/core'
import { useRouteQuery } from '@vueuse/router'
import { onErrorCaptured, shallowRef, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useLangQuery } from '~/composables/useLangQuery'
import { accessToken } from '~/constants'

const isDark = useDark({ storage: sessionStorage })
const theme = useRouteQuery('theme')
const tokenQuery = useRouteQuery('access-token')

watch(
  tokenQuery,
  (value) => {
    if (typeof value === 'string' && value) accessToken.value = value
  },
  { immediate: true },
)

watch(
  theme,
  (value) => {
    if (value === 'dark') isDark.value = true
    if (value === 'light') isDark.value = false
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
