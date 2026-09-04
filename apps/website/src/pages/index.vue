<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="t('home.title')" />
    <main class="p-4">
      <nav class="space-y-3" :aria-label="t('home.title')">
        <RouterLink
          to="/help"
          class="min-h-12 w-full flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
        >
          <span>{{ t('home.helpCenter') }}</span>
          <span aria-hidden="true" class="text-text-secondary">›</span>
        </RouterLink>
        <RouterLink
          to="/devices"
          class="min-h-12 w-full flex items-center justify-between rounded-standard border border-stroke bg-surface px-4 text-body"
        >
          <span>{{ t('home.deviceManagement') }}</span>
          <span aria-hidden="true" class="text-text-secondary">›</span>
        </RouterLink>
      </nav>
    </main>
  </div>
</template>
