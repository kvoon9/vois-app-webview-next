<script setup lang="ts">
import { isSupportBridge } from '@vois/webview-bridge'
import { useDark } from '@vueuse/core'
import { useRouteQuery } from '@vueuse/router'
import { onErrorCaptured, shallowRef, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ToastHost from '~/components/ToastHost.vue'
import { useLangQuery } from '~/composables/useLangQuery'
import { fetchPageParams, BOOT_TOKEN_TIMEOUT_MS } from '~/composables/usePageParams'
import { whenWebviewBridge } from '~/composables/useWebviewBridge'
import { nativeTheme } from '~/constants'
import { resolveBridgeAccessToken } from '~/utils/access-token'

const { t } = useI18n()
const route = useRoute()
const launchQuery = new URLSearchParams(window.location.search)
const isDark = useDark({ storage: sessionStorage })
const theme = useRouteQuery('theme')

/**
 * The bridge is the only token source, so this one read covers every case: native
 * answers with the live token, and under the debug server the debug entry does.
 * A desktop browser with neither leaves it empty.
 *
 * It waits far longer than a page would, because requests wait on it too; a page
 * that runs out of patience first still renders its retry button.
 */
async function loadBridgeAccessToken(): Promise<void> {
  const params = await fetchPageParams(
    { supported: isSupportBridge(), whenReady: whenWebviewBridge },
    route.path,
    ['access-token'],
    BOOT_TOKEN_TIMEOUT_MS,
  )
  resolveBridgeAccessToken(params['access-token'])
}
void loadBridgeAccessToken()

watch(
  [theme, nativeTheme],
  ([value, fromNative]) => {
    const selectedTheme = value || fromNative || launchQuery.get('theme')
    if (selectedTheme === 'dark') isDark.value = true
    if (selectedTheme === 'light') isDark.value = false
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
