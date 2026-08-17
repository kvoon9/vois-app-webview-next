<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import TranslationSettingsPage from '~/components/settings/TranslationSettingsPage.vue'

const route = useRoute()
</script>

<template>
  <RouterView v-if="route.name === '/settings/groups/[groupId]'" />
  <TranslationSettingsPage v-else kind="groups" />
</template>
