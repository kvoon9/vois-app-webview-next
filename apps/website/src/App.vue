<script setup lang="ts">
import { useDark } from '@vueuse/core'
import { computed, onErrorCaptured, shallowRef, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ToastHost from '~/components/ToastHost.vue'
import { useLangQuery } from '~/composables/useLangQuery'
import { usePageParams } from '~/composables/usePageParams'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import { nativeTheme } from '~/constants'
import { useAccountProfile } from '~/composables/useAccountProfile'
import { copyToClipboard } from '~/utils/bridge/clipboard-bridge'

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
/** Stack traces are for dev and the debug server, never for end users. */
const detailsVisible = import.meta.env.DEV || isWebviewDebug()
const copied = shallowRef(false)
const errorDetails = computed(() => {
  const current = error.value
  if (!current) return ''
  return [
    `${current.name}: ${current.message}`,
    current.stack ?? '',
    `URL: ${location.href}`,
    `UA: ${navigator.userAgent}`,
    `Time: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n\n')
})

async function copyDetails(): Promise<void> {
  copied.value = await copyToClipboard(errorDetails.value)
}

onErrorCaptured((err) => {
  const current = err instanceof Error ? err : new Error(String(err))
  console.error('[App.onErrorCaptured]', current)
  error.value = current
  copied.value = false
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
    <div v-if="detailsVisible" class="w-full">
      <p class="mb-2 text-small font-medium text-text-secondary">{{ t('error.details') }}</p>
      <pre
        class="max-h-[45vh] w-full overflow-auto whitespace-pre-wrap break-all rounded-standard bg-surface-field p-3 text-left font-mono text-small text-text-primary"
        >{{ errorDetails }}</pre>
    </div>
    <div class="mt-6 flex w-full flex-col space-y-3">
      <button type="button" class="btn-primary" @click="error = null">
        {{ t('error.retry') }}
      </button>
      <button
        v-if="detailsVisible"
        type="button"
        class="text-small text-primary"
        @click="copyDetails"
      >
        {{ copied ? t('error.copied') : t('error.copy') }}
      </button>
    </div>
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
