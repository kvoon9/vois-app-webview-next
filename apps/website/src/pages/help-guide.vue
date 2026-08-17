<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'

const route = useRoute()

// Forward the webview launch params (access-token, lang, device-*) to the platform help page
const helpUrl = computed(() => {
  // SAFETY: native app always launches the webview with flat string query params
  const params = new URLSearchParams(route.query as Record<string, string>)
  return `http://guide.weila.hk/help.html?${params}`
})
</script>

<template>
  <div class="h-svh flex flex-col bg-surface text-text-primary">
    <PageHeader :title="$t('help.backgroundHelp')" />
    <iframe :src="helpUrl" :title="$t('help.backgroundHelp')" class="flex-1 w-full border-none" />
  </div>
</template>
