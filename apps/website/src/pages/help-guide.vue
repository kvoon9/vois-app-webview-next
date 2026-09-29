<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '~/components/PageHeader.vue'
import { usePageParams } from '~/composables/usePageParams'

const HELP_PARAMS = ['lang', 'device-type'] as const

const { t } = useI18n()
const { params } = usePageParams(HELP_PARAMS)

const helpUrl = computed(() => {
  // TODO(contract): the external help page's exact accepted fields are unconfirmed; update when known.
  const search = new URLSearchParams()
  for (const name of HELP_PARAMS) {
    const value = params.value[name]
    if (value != null) search.set(name, value)
  }
  return `https://api.voischat.cn/help/background/?${search}`
})
</script>

<template>
  <div class="h-svh flex flex-col bg-surface text-text-primary">
    <PageHeader :title="t('help.backgroundHelp')" />
    <iframe :src="helpUrl" :title="t('help.backgroundHelp')" class="flex-1 w-full border-none" />
  </div>
</template>
