<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import LanguageSwitcher from '~/components/LanguageSwitcher.vue'
import PageHeader from '~/components/PageHeader.vue'
import SavedLoginAccounts from '~/components/login/SavedLoginAccounts.vue'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import { nativeLang } from '~/constants'

const { t } = useI18n({ useScope: 'global' })
const loginEnabled = import.meta.env.DEV || isWebviewDebug()
// The App owns its language; only a standalone web page needs the picker.
const showLanguageSwitcher = computed(() => nativeLang.value === null)
// Test tools ride the same gate: they talk to bridge protocols that only make
// sense with the real App or the debug pipeline attached.
const testToolsEnabled = loginEnabled
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

      <div v-if="showLanguageSwitcher" class="mb-6">
        <LanguageSwitcher />
      </div>

      <SavedLoginAccounts :can-add-account="loginEnabled" />
      <nav class="space-y-3" :aria-label="t('home.title')">
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
        <RouterLink v-if="testToolsEnabled" to="/permission-test" class="min-h-12 w-full nav-item">
          <span>{{ t('home.permissionTest') }}</span>
          <span class="row-chevron" aria-hidden="true" />
        </RouterLink>
      </nav>
    </main>
  </div>
</template>
