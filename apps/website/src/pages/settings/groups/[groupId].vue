<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import TranslationProfilePage from '~/components/settings/TranslationProfilePage.vue'

const route = useRoute()
</script>

<template>
  <RouterView v-if="route.name === '/settings/groups/[groupId]/members'" />
  <TranslationProfilePage v-else kind="groups" />
</template>
