<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import ResultModal from '~/components/ResultModal.vue'
import TranslationSettingModal from '~/components/settings/TranslationSettingModal.vue'
import TranslationTargetList from '~/components/settings/TranslationTargetList.vue'
import { getLoginId } from '~/utils/login-id'
import {
  changeGroupMember,
  getGroupMembers,
  getTranslationLanguages,
  type TranslationSetting,
  type TranslationTarget,
} from '~/utils/translation-api'

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const loginId = getLoginId()
const selected = shallowRef<TranslationTarget | null>(null)
const saving = shallowRef(false)
const resultError = shallowRef<string | null>(null)

const groupId = computed(() => {
  const value = Array.isArray(route.params.groupId) ? route.params.groupId[0] : route.params.groupId
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
})

const pageTitle = computed(() => {
  const name = Array.isArray(route.query.name) ? route.query.name[0] : route.query.name
  return name || t('translation.groupMembers')
})

async function load(): Promise<{ items: TranslationTarget[]; languages: string[] }> {
  if (loginId == null) throw new Error(t('translation.invalidLoginId'))
  if (groupId.value == null) throw new Error(t('translation.invalidGroupId'))

  const [group, languages] = await Promise.all([
    getGroupMembers(loginId, groupId.value),
    getTranslationLanguages(),
  ])
  return { items: group.members, languages }
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

async function save(setting: TranslationSetting): Promise<void> {
  if (loginId == null || groupId.value == null || !selected.value || saving.value) return

  saving.value = true
  try {
    const updated = await changeGroupMember(
      loginId,
      groupId.value,
      selected.value.id,
      setting.source,
      setting.target,
    )
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
        {{ $t('translation.emptyMembers') }}
      </p>

      <TranslationTargetList v-else :items="state.items" kind="friends" @edit="selected = $event" />
    </main>

    <TranslationSettingModal
      v-if="selected"
      :key="selected.id"
      :item="selected"
      :languages="state.languages"
      :saving="saving"
      member-only
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
