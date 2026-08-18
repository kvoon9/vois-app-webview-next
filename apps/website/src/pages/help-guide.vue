<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'

const route = useRoute()

const helpUrl = computed(() => {
  // SAFETY: help.vue forwards the native app's flat string query parameters.
  const params = new URLSearchParams(route.query as Record<string, string>)
  return `https://api.voischat.cn/help/background/?${params}`
})
</script>

<template>
  <div class="h-svh flex flex-col bg-surface text-text-primary">
    <PageHeader :title="$t('help.backgroundHelp')" />
    <iframe :src="helpUrl" :title="$t('help.backgroundHelp')" class="flex-1 w-full border-none" />
  </div>
</template>
