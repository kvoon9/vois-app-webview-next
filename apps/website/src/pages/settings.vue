<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageHeader from '~/components/PageHeader.vue'

const { t } = useI18n()
const route = useRoute()
</script>

<template>
  <RouterView v-if="route.name !== '/settings'" />
  <div v-else class="page">
    <PageHeader :title="t('settings.title')" />

    <main class="p-4">
      <div class="space-y-3">
        <RouterLink
          v-for="item in ['friends', 'groups', 'devices']"
          :key="item"
          :to="`/settings/${item}`"
          class="card min-h-16 w-full flex items-center justify-between text-left"
        >
          <span class="text-body font-medium">{{ t(`settings.${item}`) }}</span>
          <span class="row-chevron" aria-hidden="true" />
        </RouterLink>
      </div>
    </main>
  </div>
</template>
