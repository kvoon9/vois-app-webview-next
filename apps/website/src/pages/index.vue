<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import { useCredentialSession } from '~/utils/auth'

const { t } = useI18n({ useScope: 'global' })
const loginEnabled = import.meta.env.DEV || isWebviewDebug()
const { session } = useCredentialSession()
</script>

<template>
  <div class="page">
    <PageHeader :title="t('home.title')" />
    <main class="p-4">
      <!-- Decorative hero glyph: the page title already names the screen, so the
           icon is hidden from assistive tech rather than announced twice. -->
      <div class="mb-6 flex justify-center">
        <span class="i-ph-compass text-6xl text-primary" aria-hidden="true" />
      </div>

      <nav class="space-y-3" :aria-label="t('home.title')">
        <RouterLink v-if="loginEnabled" to="/login" class="btn-primary">
          <span>{{ t(session ? 'login.switchAccount' : 'login.title') }}</span>
        </RouterLink>
        <RouterLink to="/help" class="min-h-12 w-full nav-item">
          <span>{{ t('home.helpCenter') }}</span>
          <span class="row-chevron" aria-hidden="true" />
        </RouterLink>
        <RouterLink to="/devices" class="min-h-12 w-full nav-item">
          <span>{{ t('home.deviceManagement') }}</span>
          <span class="row-chevron" aria-hidden="true" />
        </RouterLink>
        <RouterLink to="/settings" class="min-h-12 w-full nav-item">
          <span>{{ t('settings.title') }}</span>
          <span class="row-chevron" aria-hidden="true" />
        </RouterLink>
      </nav>
    </main>
  </div>
</template>
