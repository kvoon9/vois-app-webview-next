<script setup lang="ts">
import { useDark } from '@vueuse/core'
import { useRouteQuery } from '@vueuse/router'
import { onErrorCaptured, shallowRef, watch } from 'vue'
import { RouterView } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ToastHost from '~/components/ToastHost.vue'
import { useLangQuery } from '~/composables/useLangQuery'
import { accessToken } from '~/constants'
import { ACCESS_TOKEN_PATH } from '~/utils/auth-token-path'

const { t } = useI18n()
const launchQuery = new URLSearchParams(window.location.search)
const isDark = useDark({ storage: sessionStorage })
const theme = useRouteQuery('theme')
const tokenQuery = useRouteQuery<string | null>('access-token')

watch(
  tokenQuery,
  (value) => {
    const token = value || launchQuery.get('access-token')
    if (token) accessToken.value = token
  },
  { immediate: true },
)

/**
 * Dev and preview servers expose the worktree-shared token; a production build
 * has no such endpoint, so a failed probe just leaves the launch query and
 * `VITE_ACCESS_TOKEN` fallback in charge.
 */
async function loadSharedAccessToken(): Promise<void> {
  try {
    const response = await fetch(ACCESS_TOKEN_PATH)
    // SAFETY: the dev server owns the endpoint and always answers { token: string | null }
    const { token } = (await response.json()) as { token: string | null }
    // A launch token is fresher than the stored file, so it outranks the response
    if (token && !tokenQuery.value && !launchQuery.get('access-token')) accessToken.value = token
  } catch {
    /* no endpoint outside the dev/preview servers */
  }
}
void loadSharedAccessToken()

watch(
  theme,
  (value) => {
    const selectedTheme = value || launchQuery.get('theme')
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
