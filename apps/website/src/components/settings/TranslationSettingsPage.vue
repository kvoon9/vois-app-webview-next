<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import TranslationTargetList from '~/components/settings/TranslationTargetList.vue'
import { getLoginId } from '~/utils/login-id'
import {
  getTranslationTargets,
  type TranslationTarget,
  type TranslationTargetKind,
} from '~/utils/translation-api'

const props = defineProps<{
  kind: TranslationTargetKind
}>()

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const loginId = getLoginId()

const pageTitle = computed(() => t(`settings.${props.kind}`))
const emptyText = computed(() =>
  t(props.kind === 'friends' ? 'translation.emptyFriends' : 'translation.emptyGroups'),
)

async function load(): Promise<{ items: TranslationTarget[] }> {
  if (loginId == null) throw new Error(t('translation.invalidLoginId'))

  const items = await getTranslationTargets(props.kind, loginId)
  return { items }
}

const {
  state,
  isLoading,
  error,
  executeImmediate: reload,
} = useAsyncState(load, { items: [] }, { resetOnExecute: false })

const errorMessage = computed(() =>
  error.value instanceof Error ? error.value.message : error.value ? String(error.value) : '',
)

function openItem(item: TranslationTarget): void {
  if (props.kind === 'friends') {
    router.push({ path: `/settings/friends/${item.id}` })
    return
  }

  router.push({ path: `/settings/groups/${item.id}` })
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="pageTitle" />

    <main class="p-4">
      <div
        v-if="isLoading && state.items.length === 0"
        class="py-12 text-center text-body text-text-secondary"
      >
        {{ $t('translation.loading') }}
      </div>

      <div v-else-if="errorMessage && state.items.length === 0" class="py-12 text-center">
        <p class="text-body text-danger">{{ errorMessage }}</p>
        <button
          type="button"
          class="mt-4 rounded-small bg-primary px-4 py-2 text-primary-text"
          @click="reload()"
        >
          {{ $t('translation.retry') }}
        </button>
      </div>

      <p
        v-else-if="state.items.length === 0"
        class="py-12 text-center text-body text-text-secondary"
      >
        {{ emptyText }}
      </p>

      <TranslationTargetList v-else :items="state.items" :kind="kind" @open="openItem" />
    </main>
  </div>
</template>
