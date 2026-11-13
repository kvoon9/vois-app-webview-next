<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageHeader from '~/components/PageHeader.vue'

const { t } = useI18n()
const route = useRoute()

const SECTIONS = [
  { path: 'friends', label: 'settings.friends' },
  { path: 'groups', label: 'settings.groups' },
  { path: 'devices', label: 'settings.devices' },
] as const
</script>

<template>
  <RouterView v-if="route.name !== '/settings'" />
  <div v-else class="page">
    <PageHeader :title="t('settings.title')" />

    <main class="p-4">
      <div class="space-y-3">
        <RouterLink
          v-for="section in SECTIONS"
          :key="section.path"
          :to="`/settings/${section.path}`"
          class="card min-h-16 w-full flex items-center justify-between text-left"
        >
          <span class="text-body font-medium">{{ t(section.label) }}</span>
          <span class="row-chevron" aria-hidden="true" />
        </RouterLink>
      </div>
    </main>
  </div>
</template>
