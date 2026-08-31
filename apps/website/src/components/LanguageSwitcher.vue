<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { i18n, SUPPORTED_LOCALES } from '~/i18n'

const { t } = useI18n()
const currentLocale = computed(() => i18n.global.locale.value)

function cycleLocale() {
  const currentIndex = SUPPORTED_LOCALES.indexOf(currentLocale.value)
  const nextIndex = (currentIndex + 1) % SUPPORTED_LOCALES.length
  i18n.global.locale.value = SUPPORTED_LOCALES[nextIndex]
}
</script>

<template>
  <button
    type="button"
    class="px-2 py-1 text-xs rounded-small transition-colors bg-surface-muted text-text-secondary hover:bg-surface-field"
    :aria-label="t('language.title')"
    @click="cycleLocale"
  >
    {{ t(`language.${currentLocale}`) }}
  </button>
</template>
