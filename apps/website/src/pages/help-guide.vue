<script setup lang="ts">
import PageHeader from '~/components/PageHeader.vue'
</script>

<template>
  <div class="h-svh flex flex-col bg-surface text-text-primary">
    <PageHeader :title="$t('help.backgroundHelp')" />
    <iframe
      src="http://guide.weila.hk/help.html"
      :title="$t('help.backgroundHelp')"
      class="flex-1 w-full border-none"
    />
  </div>
</template>
