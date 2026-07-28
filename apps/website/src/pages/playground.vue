<script setup lang="ts">
import PageHeader from '~/components/PageHeader.vue'

const title = 'WebView Bridge Playground'
</script>

<template>
  <div class="h-svh flex flex-col bg-surface text-text-primary">
    <PageHeader :title="title" />
    <iframe
      src="https://vois-webview-bridge-playground.pages.dev"
      :title="title"
      class="flex-1 w-full border-none"
    />
  </div>
</template>
