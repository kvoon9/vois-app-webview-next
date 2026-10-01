<script setup lang="ts">
import { useDark } from '@vueuse/core'
import { onErrorCaptured, shallowRef, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ToastHost from '~/components/ToastHost.vue'
import { useLangQuery } from '~/composables/useLangQuery'
import { usePageParams } from '~/composables/usePageParams'
import { nativeTheme } from '~/constants'
import { useAccountProfile } from '~/composables/useAccountProfile'

const { t } = useI18n()
const isDark = useDark({ storage: sessionStorage })
usePageParams()
useAccountProfile()

watch(
  nativeTheme,
  (fromNative) => {
    if (fromNative === 'dark') isDark.value = true
    if (fromNative === 'light') isDark.value = false
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
  <div v-if="error" class="page flex flex-col items-center justify-center p-8">
    <h1 class="text-lg font-bold mb-2">{{ t('error.title') }}</h1>
    <p class="text-body text-text-secondary text-center mb-6">
      {{ t('error.description') }}
    </p>
    <button type="button" class="btn-primary" @click="error = null">{{ t('error.retry') }}</button>
  </div>
  <template v-else>
    <RouterView />
    <ToastHost />
  </template>
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
