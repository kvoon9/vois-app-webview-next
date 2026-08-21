<script setup lang="ts">
import { useQuery } from '@pinia/colada'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import QueryState from '~/components/settings/QueryState.vue'
import TranslationTargetList from '~/components/settings/TranslationTargetList.vue'
import { useAccountId } from '~/composables/useAccountId'
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
const { accountId, accountQuery } = useAccountId()

// Device flow enters here directly with ?login-id&name; show the device name as title
const deviceName = computed(() => {
  const name = route.query.name
  return (Array.isArray(name) ? name[0] : name) || ''
})
const pageTitle = computed(() => deviceName.value || t(`settings.${props.kind}`))
const emptyText = computed(() =>
  t(props.kind === 'friends' ? 'translation.emptyFriends' : 'translation.emptyGroups'),
)

async function load(): Promise<{ items: TranslationTarget[] }> {
  if (accountId.value == null) throw new Error(t('translation.invalidLoginId'))
  return { items: await getTranslationTargets(props.kind, accountId.value) }
}

const { state, refetch: reload } = useQuery({
  key: () => ['translation', 'targets', props.kind, accountId.value],
  query: load,
})

const items = computed(() => state.value.data?.items ?? [])

function openItem(item: TranslationTarget): void {
  if (props.kind === 'friends') {
    router.push({ path: `/settings/friends/${item.id}`, query: accountQuery.value })
    return
  }

  router.push({ path: `/settings/groups/${item.id}`, query: accountQuery.value })
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="pageTitle" />

    <main class="p-4">
      <QueryState
        :status="state.status"
        :error="state.error"
        :empty="items.length === 0"
        :empty-text="emptyText"
        @retry="reload()"
      >
        <TranslationTargetList :items="items" :kind="kind" @open="openItem" />
      </QueryState>
    </main>
  </div>
</template>
