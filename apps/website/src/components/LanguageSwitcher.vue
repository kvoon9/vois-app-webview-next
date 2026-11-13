<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, type SupportedLocale } from '~/i18n'

const { t, locale } = useI18n()

const OPTION_KEYS = {
  en: 'language.en',
  'zh-CN': 'language.zh-CN',
  'zh-TW': 'language.zh-TW',
} as const

function select(next: SupportedLocale): void {
  locale.value = next
}
</script>

<template>
  <div class="flex flex-wrap items-center space-x-2" role="group" :aria-label="t('language.title')">
    <button
      v-for="option in SUPPORTED_LOCALES"
      :key="option"
      type="button"
      class="chip"
      :class="locale === option ? 'chip-selected' : 'chip-unselected'"
      :aria-pressed="locale === option"
      @click="select(option)"
    >
      {{ t(OPTION_KEYS[option]) }}
    </button>
  </div>
</template>
