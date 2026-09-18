<script setup lang="ts">
import { useQuery, useQueryCache } from '@pinia/colada'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import ResultModal from '~/components/ResultModal.vue'
import LanguagePickerDrawer from '~/components/settings/LanguagePickerDrawer.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseAccountId, useAccountId } from '~/composables/useAccountId'
import { nextSettingForSkill, swapLanguagePair, ZH_EN_LANGUAGES } from '~/utils/translation-setting'
import { hideBrokenImage } from '~/utils/image'
import {
  changeTranslationTarget,
  getTranslationTarget,
  type TranslationSetting,
  type TranslationSkill,
  type TranslationTarget,
  type TranslationTargetKind,
} from '~/utils/translation-api'

const props = defineProps<{
  kind: TranslationTargetKind
}>()

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const { accountId, accountQuery } = useAccountId()
const queryCache = useQueryCache()
const saving = shallowRef(false)
const resultError = shallowRef<string | null>(null)

const targetId = computed(() => {
  const raw = route.params[props.kind === 'friends' ? 'id' : 'groupId']
  return parseAccountId(Array.isArray(raw) ? raw[0] : raw)
})

// The multi-language editor lives on its own route; build the link once here.
// `route.query` carries `friend-type` through so the editor can pick its title,
// and the skill is forced to 3 so this row always opens the editor instead of
// the tip that the stored Chinese-English skills would show.
const multiTranslationLink = computed(() => {
  const isFriend = props.kind === 'friends'
  return {
    path: `/settings/${props.kind}/multi-translation`,
    query: {
      ...route.query,
      [isFriend ? 'friend-id' : 'group-id']: String(targetId.value ?? ''),
      [isFriend ? 'friend-skill' : 'group-skill']: '3',
    },
  }
})

async function load(): Promise<TranslationTarget> {
  if (accountId.value == null) throw new Error(t('translation.invalidLoginId'))
  if (targetId.value == null) throw new Error(t('profile.notFound'))

  const item = await getTranslationTarget(props.kind, accountId.value, targetId.value)
  if (!item) throw new Error(t('profile.notFound'))
  return item
}

const { state, refetch: reload } = useQuery({
  key: () => ['translation', 'target', props.kind, accountId.value, targetId.value],
  query: load,
})

const item = computed(() => state.value.data ?? null)

// Skill 2 pins the pair to zh-CN <-> en-US but still lets the user flip which
// side is the source, so only that direction toggle stays inline; the free-form
// pair lives on the multi-translation page.
const isZhEn = computed(() => item.value?.skill === 2)

const modes = computed(() => [
  { skill: 0 as const, label: t('translation.skills.off') },
  { skill: 1 as const, label: t('translation.skills.basic') },
  { skill: 2 as const, label: t('translation.skills.premiumZhEn') },
  { skill: 3 as const, label: t('translation.skills.premiumMulti') },
])

async function save(setting: TranslationSetting): Promise<void> {
  if (accountId.value == null || !item.value || saving.value) return

  saving.value = true
  try {
    await changeTranslationTarget(props.kind, accountId.value, item.value.id, setting)
    await queryCache.invalidateQueries({ key: ['translation'] })
  } catch (error) {
    resultError.value = error instanceof Error ? error.message : String(error)
  } finally {
    saving.value = false
  }
}

function selectSkill(skill: TranslationSkill): void {
  if (!item.value) return
  const next = nextSettingForSkill(item.value, skill, [])
  if (next) save(next)
}

function swapLanguages(): void {
  if (!item.value) return
  save(swapLanguagePair(item.value))
}
</script>

<template>
  <div class="page">
    <PageHeader :title="item?.name ?? t('settings.title')" />

    <main class="p-4">
      <QueryState :status="state.status" :error="state.error" @retry="reload()">
        <template v-if="item">
          <div class="flex flex-col items-center py-4 text-center">
            <span
              class="relative h-20 w-20 flex items-center justify-center overflow-hidden rounded-full bg-surface-muted text-2xl text-text-secondary"
            >
              {{ item.name.slice(0, 1) }}
              <img
                v-if="item.avatar"
                :src="item.avatar"
                alt=""
                class="absolute inset-0 h-full w-full object-cover"
                @error="hideBrokenImage"
              />
            </span>
            <span class="mt-3 text-header font-semibold">{{ item.name }}</span>
            <span v-if="item.number" class="mt-1 text-small text-text-secondary">
              {{ t('profile.userNumber', { id: item.number }) }}
            </span>
          </div>

          <!-- Temporarily hidden: non-translation sections; restore by uncommenting -->
          <!-- ponytail: media/location/notifications/remarks rows are UI-only placeholders per design; native owns these features
        <div class="mt-2 panel">
          <div
            class="panel-row min-h-12 text-body"
            aria-disabled="true"
          >
            {{ t('profile.media') }}
            <span class="row-chevron" aria-hidden="true" />
          </div>
          <div
            class="panel-row min-h-12 text-body"
            aria-disabled="true"
          >
            {{ t('profile.location') }}
            <span class="row-chevron" aria-hidden="true" />
          </div>
        </div>
        -->

          <div class="mt-4 card">
            <div class="space-y-2" role="group" :aria-label="t('translation.mode')">
              <template v-for="mode in modes" :key="mode.skill">
                <RouterLink
                  v-if="mode.skill === 3"
                  :to="multiTranslationLink"
                  class="min-h-11 w-full flex items-center justify-between rounded-standard px-4 text-2nd-body bg-surface-muted text-text-secondary"
                  :class="{ 'bg-surface-selected text-text-primary': item.skill === 3 }"
                >
                  {{ mode.label }}
                  <span class="row-chevron" aria-hidden="true" />
                </RouterLink>
                <button
                  v-else
                  type="button"
                  class="min-h-11 w-full rounded-standard px-4 text-left text-2nd-body transition-colors"
                  :class="
                    item.skill === mode.skill
                      ? 'bg-surface-selected text-text-primary'
                      : 'bg-surface-muted text-text-secondary'
                  "
                  :aria-pressed="item.skill === mode.skill"
                  :disabled="saving"
                  @click="selectSkill(mode.skill)"
                >
                  {{ mode.label }}
                </button>
              </template>
            </div>

            <div v-if="isZhEn" class="mt-4">
              <LanguagePickerDrawer
                :model-value="item.source"
                :disabled="true"
                :label="t('translation.source')"
                :languages="[...ZH_EN_LANGUAGES]"
                :title="t('translation.source')"
              />

              <div class="my-2 flex justify-center">
                <button
                  type="button"
                  class="h-11 w-11 touch-manipulation flex items-center justify-center rounded-full bg-surface-muted text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                  :aria-label="t('translation.swapLanguages')"
                  :disabled="saving"
                  @click="swapLanguages"
                >
                  <span class="i-ph-arrows-down-up text-header" aria-hidden="true" />
                </button>
              </div>

              <LanguagePickerDrawer
                :model-value="item.target"
                :disabled="true"
                :label="t('translation.target')"
                :languages="[...ZH_EN_LANGUAGES]"
                :title="t('translation.target')"
              />
            </div>
          </div>

          <!--
        <div class="mt-4 panel">
          <div
            v-for="row in kind === 'friends'
              ? ['profile.muteNotifications', 'profile.readReceipts', 'profile.stickOnTop']
              : ['profile.muteNotifications', 'profile.readReceipts']"
            :key="row"
            class="panel-row min-h-12 text-body"
            aria-disabled="true"
          >
            {{ t(row) }}
            <span
              class="relative h-7 w-12 flex-none rounded-full bg-fill"
              aria-hidden="true"
            >
          <span class="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow" />
            </span>
          </div>
          <div
            class="panel-row min-h-12 text-body"
            aria-disabled="true"
          >
            {{ t('profile.editRemarks') }}
            <span class="row-chevron" aria-hidden="true" />
          </div>
        </div>
        -->

          <RouterLink
            v-if="kind === 'groups'"
            :to="{
              path: `/settings/groups/${item.id}/members`,
              query: { ...accountQuery, name: item.name },
            }"
            class="mt-4 min-h-12 nav-item"
          >
            {{ t('profile.members') }}
            <span class="row-chevron" aria-hidden="true" />
          </RouterLink>

          <!--
        <div class="mt-4 panel">
          <div class="min-h-12 flex items-center px-4 text-body" aria-disabled="true">
            {{ t('profile.clearHistory') }}
          </div>
          <RouterLink
            :to="{
              path: kind === 'friends' ? '/report-user' : '/report-group',
              query: { id: item.id },
            }"
            class="min-h-12 flex items-center px-4 text-body text-danger"
          >
            {{ t('profile.report') }}
          </RouterLink>
          <div class="min-h-12 flex items-center px-4 text-body text-danger" aria-disabled="true">
            {{ t(kind === 'friends' ? 'profile.block' : 'profile.exitGroup') }}
          </div>
        </div>
        -->
        </template>
      </QueryState>
    </main>

    <ResultModal
      v-if="resultError"
      type="error"
      :message="resultError"
      @close="resultError = null"
    />
  </div>
</template>
