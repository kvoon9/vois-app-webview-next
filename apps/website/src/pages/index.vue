<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import { useAccountId } from '~/composables/useAccountId'

const { t } = useI18n({ useScope: 'global' })
const { accountQuery } = useAccountId()
</script>

<template>
  <div class="page">
    <PageHeader :title="t('home.title')" />
    <main class="p-4">
      <!-- Decorative hero glyph: the page title already names the screen, so the
           icon is hidden from assistive tech rather than announced twice. -->
      <div class="mb-6 flex justify-center">
        <span class="i-ph-translate text-6xl text-primary" aria-hidden="true" />
      </div>

      <nav class="space-y-3" :aria-label="t('home.title')">
        <RouterLink to="/help" class="min-h-12 w-full nav-item">
          <span>{{ t('home.helpCenter') }}</span>
          <span class="row-chevron" aria-hidden="true" />
        </RouterLink>
        <RouterLink to="/devices" class="min-h-12 w-full nav-item">
          <span>{{ t('home.deviceManagement') }}</span>
          <span class="row-chevron" aria-hidden="true" />
        </RouterLink>
        <RouterLink
          :to="{ path: '/settings', query: accountQuery }"
          class="min-h-12 w-full nav-item"
        >
          <span>{{ t('settings.title') }}</span>
          <span class="row-chevron" aria-hidden="true" />
        </RouterLink>
      </nav>
    </main>
  </div>
</template>
