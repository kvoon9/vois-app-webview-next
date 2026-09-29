<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import TranslationTargetList from '~/components/settings/TranslationTargetList.vue'
import { useAccountId } from '~/composables/useAccountId'
import { useNavigationContext } from '~/composables/useNavigationContext'
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
const route = useRoute()
const {
  accountId,
  status: accountStatus,
  error: accountError,
  reload: reloadAccount,
} = useAccountId()
const { withContext } = useNavigationContext()

// Device flow enters here directly with ?login-id&name; show the device name as title
const deviceName = computed(() => {
  const name = route.query.name
  return (Array.isArray(name) ? name[0] : name) || ''
})
const pageTitle = computed(() => deviceName.value || t(`settings.${props.kind}`))
const emptyText = computed(() =>
  t(props.kind === 'friends' ? 'translation.emptyFriends' : 'translation.emptyGroups'),
)

const inputError = computed<Error | null>(() => {
  // While the read is pending the account is unknown, not invalid.
  if (accountStatus.value === 'pending') return null
  if (accountStatus.value === 'error') return accountError.value
  if (accountId.value == null) return new Error(t('translation.invalidLoginId'))
  return null
})
const inputsReady = computed(() => accountStatus.value !== 'pending' && inputError.value == null)

async function load(): Promise<{ items: TranslationTarget[] }> {
  if (accountId.value == null) throw new Error(t('translation.invalidLoginId'))
  return { items: await getTranslationTargets(props.kind, accountId.value) }
}

const { state, refetch } = useQuery({
  key: () => ['translation', 'targets', props.kind, accountId.value],
  query: load,
  enabled: inputsReady,
})

const items = computed(() => state.value.data?.items ?? [])
const viewStatus = computed(() => (inputError.value ? 'error' : state.value.status))
const viewError = computed(() => inputError.value ?? state.value.error)

async function retry(): Promise<void> {
  if (accountStatus.value === 'error' || inputError.value) await reloadAccount()
  else await refetch()
}

function openItem(item: TranslationTarget): void {
  const base = props.kind === 'friends' ? '/settings/friends' : '/settings/groups'
  router.push({ path: `${base}/${item.id}`, ...withContext() })
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
        :empty-text="emptyText"
        @retry="retry"
      >
        <TranslationTargetList :items="items" :kind="kind" @open="openItem" />
      </QueryState>
    </main>
  </div>
</template>
