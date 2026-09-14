<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LanguageSwitcher from '~/components/LanguageSwitcher.vue'
import { usePageBack } from '~/composables/usePageBack'

const { t } = useI18n()

defineProps<{
  title: string
}>()

const { goBack } = usePageBack()
</script>

<template>
  <header class="sticky top-0 z-10 h-14 flex items-center justify-center bg-surface">
    <button
      type="button"
      class="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11"
      :aria-label="t('nav.back')"
      @click="goBack"
    >
      <span class="i-ph-caret-left text-2xl text-text-primary" aria-hidden="true" />
    </button>
    <h1 class="page-title">{{ title }}</h1>
    <slot name="action">
      <LanguageSwitcher class="absolute right-2 top-1/2 -translate-y-1/2" />
    </slot>
  </header>
</template>
