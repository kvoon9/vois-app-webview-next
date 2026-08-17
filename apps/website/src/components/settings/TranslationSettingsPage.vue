<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import ResultModal from '~/components/ResultModal.vue'
import TranslationSettingModal from '~/components/settings/TranslationSettingModal.vue'
import TranslationTargetList from '~/components/settings/TranslationTargetList.vue'
import { getLoginId } from '~/utils/login-id'
import {
  changeTranslationTarget,
  getTranslationLanguages,
  getTranslationTargets,
  type TranslationSetting,
  type TranslationTarget,
  type TranslationTargetKind,
} from '~/utils/translation-api'

const props = defineProps<{
  kind: TranslationTargetKind
}>()

const { t } = useI18n({ useScope: 'global' })
const router = useRouter()
const loginId = getLoginId()
const selected = shallowRef<TranslationTarget | null>(null)
const saving = shallowRef(false)
const resultError = shallowRef<string | null>(null)

const pageTitle = computed(() => t(`settings.${props.kind}`))
const emptyText = computed(() =>
  t(props.kind === 'friends' ? 'translation.emptyFriends' : 'translation.emptyGroups'),
)

async function load(): Promise<{ items: TranslationTarget[]; languages: string[] }> {
  if (loginId == null) throw new Error(t('translation.invalidLoginId'))

  const [items, languages] = await Promise.all([
    getTranslationTargets(props.kind, loginId),
    getTranslationLanguages(),
  ])
  return { items, languages }
}

const {
  state,
  isLoading,
  error,
  executeImmediate: reload,
} = useAsyncState(load, { items: [], languages: [] }, { resetOnExecute: false })

const errorMessage = computed(() =>
  error.value instanceof Error ? error.value.message : error.value ? String(error.value) : '',
)

function openItem(item: TranslationTarget): void {
  if (props.kind !== 'groups') return
  if (item.skill === 0) {
    resultError.value = t('translation.enableGroupFirst')
    return
  }

  router.push({ path: `/settings/groups/${item.id}`, query: { name: item.name } })
}

async function save(setting: TranslationSetting): Promise<void> {
  if (loginId == null || !selected.value || saving.value) return

  saving.value = true
  try {
    const updated = await changeTranslationTarget(props.kind, loginId, selected.value.id, setting)
    state.value = {
      ...state.value,
      items: state.value.items.map((item) => (item.id === updated.id ? updated : item)),
    }
    selected.value = null
  } catch (error) {
    resultError.value = error instanceof Error ? error.message : String(error)
  } finally {
    saving.value = false
  }
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

      <TranslationTargetList
        v-else
        :items="state.items"
        :kind="kind"
        @edit="selected = $event"
        @open="openItem"
      />
    </main>

    <TranslationSettingModal
      v-if="selected"
      :key="selected.id"
      :item="selected"
      :languages="state.languages"
      :saving="saving"
      @cancel="selected = null"
      @confirm="save"
    />

    <ResultModal
      v-if="resultError"
      type="error"
      :message="resultError"
      @close="resultError = null"
    />
  </div>
</template>
