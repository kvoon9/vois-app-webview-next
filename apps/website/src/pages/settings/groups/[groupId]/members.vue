<script setup lang="ts">
import { useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import ResultModal from '~/components/ResultModal.vue'
import QueryState from '~/components/settings/QueryState.vue'
import TranslationSettingModal from '~/components/settings/TranslationSettingModal.vue'
import TranslationTargetList from '~/components/settings/TranslationTargetList.vue'
import { parseAccountId, useAccountId } from '~/composables/useAccountId'
import {
  changeGroupMember,
  getGroupMembers,
  getTranslationLanguages,
  type TranslationSetting,
  type TranslationTarget,
} from '~/utils/translation-api'

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const {
  accountId,
  status: accountStatus,
  error: accountError,
  reload: reloadAccount,
} = useAccountId()
const queryCache = useQueryCache()
const selected = shallowRef<TranslationTarget | null>(null)
const saving = shallowRef(false)
const resultError = shallowRef<string | null>(null)

const groupId = computed(() =>
  parseAccountId(
    Array.isArray(route.params.groupId) ? route.params.groupId[0] : route.params.groupId,
  ),
)

const pageTitle = computed(() => {
  const name = Array.isArray(route.query.name) ? route.query.name[0] : route.query.name
  return name || t('translation.groupMembers')
})

const inputError = computed<Error | null>(() => {
  // While the read is pending the account is unknown, not invalid.
  if (accountStatus.value === 'pending') return null
  if (accountStatus.value === 'error') return accountError.value
  if (accountId.value == null) return new Error(t('translation.invalidLoginId'))
  if (groupId.value == null) return new Error(t('translation.invalidGroupId'))
  return null
})
const inputsReady = computed(() => accountStatus.value !== 'pending' && inputError.value == null)

async function load(): Promise<{ items: TranslationTarget[]; languages: string[] }> {
  if (accountId.value == null) throw new Error(t('translation.invalidLoginId'))
  if (groupId.value == null) throw new Error(t('translation.invalidGroupId'))

  const [group, languages] = await Promise.all([
    getGroupMembers(accountId.value, groupId.value),
    getTranslationLanguages(),
  ])
  return { items: group.members, languages }
}

const { state, refetch } = useQuery({
  key: () => ['translation', 'members', accountId.value, groupId.value],
  query: load,
  enabled: inputsReady,
})

const items = computed(() => state.value.data?.items ?? [])
const languages = computed(() => state.value.data?.languages ?? [])
const viewStatus = computed(() => (inputError.value ? 'error' : state.value.status))
const viewError = computed(() => inputError.value ?? state.value.error)

async function retry(): Promise<void> {
  if (accountStatus.value === 'error' || inputError.value) await reloadAccount()
  else await refetch()
}

async function save(setting: TranslationSetting): Promise<void> {
  if (accountId.value == null || groupId.value == null || !selected.value || saving.value) return

  saving.value = true
  try {
    await changeGroupMember(
      accountId.value,
      groupId.value,
      selected.value.id,
      setting.source,
      setting.target,
    )
    selected.value = null
    await queryCache.invalidateQueries({ key: ['translation'] })
  } catch (error) {
    resultError.value = error instanceof Error ? error.message : String(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="pageTitle" />

    <main class="p-4">
      <QueryState
        :status="viewStatus"
        :error="viewError"
        :empty="items.length === 0"
        :empty-text="t('translation.emptyMembers')"
        @retry="retry"
      >
        <TranslationTargetList
          :items="items"
          kind="friends"
          member-only
          @edit="selected = $event"
        />
      </QueryState>
    </main>

    <TranslationSettingModal
      v-if="selected"
      :key="selected.id"
      :item="selected"
      :languages="languages"
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
