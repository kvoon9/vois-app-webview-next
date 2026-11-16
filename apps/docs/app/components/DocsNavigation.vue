<script setup lang="ts">
import type { DocsNavItem } from '~/composables/useDocsNavigation'

defineProps<{ navigation: DocsNavItem[] }>()
</script>

<template>
  <UContentNavigation :navigation="navigation" type="multiple" highlight />
</template>
