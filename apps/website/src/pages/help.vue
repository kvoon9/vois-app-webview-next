<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PageHeader from '~/components/PageHeader.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

function openBackgroundHelp() {
  router.push({ path: '/help-guide', query: route.query })
}
</script>

<template>
  <div class="page">
    <PageHeader :title="t('help.title')" />

    <main class="p-4">
      <!-- TODO: temporarily hidden, restore FAQ & playground sections when content is ready -->
      <h2 class="section-title mb-4">{{ t('help.backgroundHelp') }}</h2>
      <button
        type="button"
        class="card w-full flex items-center justify-between text-left"
        @click="openBackgroundHelp()"
      >
        <span class="text-body pr-4">{{ t('help.backgroundHelp') }}</span>
        <span class="i-ph-arrow-up-right" aria-hidden="true" />
      </button>

      <h2 class="section-title mt-8 mb-4">{{ t('help.contact') }}</h2>
      <div class="space-y-3">
        <button
          type="button"
          class="card w-full flex items-center justify-between text-left"
          @click="router.push('/feedback')"
        >
          <span class="text-body">{{ t('help.feedback') }}</span>
          <span class="i-ph-arrow-up-right" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="card w-full flex items-center justify-between text-left"
          @click="router.push('/report')"
        >
          <span class="text-body">{{ t('help.report') }}</span>
          <span class="i-ph-arrow-up-right" aria-hidden="true" />
        </button>
      </div>
    </main>
  </div>
</template>
