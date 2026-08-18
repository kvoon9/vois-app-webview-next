<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import TranslationSettingsPage from '~/components/settings/TranslationSettingsPage.vue'

const route = useRoute()
</script>

<template>
  <RouterView v-if="route.name === '/settings/friends/[id]'" />
  <TranslationSettingsPage v-else kind="friends" />
</template>
