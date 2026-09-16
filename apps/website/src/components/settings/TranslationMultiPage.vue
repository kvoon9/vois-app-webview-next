<script setup lang="ts">
import { useQuery, useQueryCache } from '@pinia/colada'
import { useRouteQuery } from '@vueuse/router'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '~/components/PageHeader.vue'
import ResultModal from '~/components/ResultModal.vue'
import QueryState from '~/components/settings/QueryState.vue'
import { parseAccountId, useAccountId } from '~/composables/useAccountId'
import { usePageBack } from '~/composables/usePageBack'
import { hideBrokenImage } from '~/utils/image'
import {
  initialLanguagePair,
  pickLanguagePair,
  swapLanguagePair,
} from '~/utils/translation-setting'
import {
  createTranslationLanguageOptions,
  filterTranslationLanguageOptions,
} from '~/utils/translation-language'
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

const { t, locale } = useI18n({ useScope: 'global' })
const { accountId } = useAccountId()
const queryCache = useQueryCache()
const { goBack } = usePageBack()

const idQuery = useRouteQuery<string | null>(props.kind === 'friends' ? 'friend-id' : 'group-id')
const targetId = computed(() => parseAccountId(idQuery.value))

const step = shallowRef<'source' | 'target'>('source')
const search = shallowRef('')
const enabled = shallowRef(true)
const saving = shallowRef(false)
const resultError = shallowRef<string | null>(null)
const draft = shallowRef<TranslationSetting>({ skill: 3, source: 'zh-CN', target: 'en-US' })

async function load(): Promise<{ item: TranslationTarget; languages: string[] }> {
  if (accountId.value == null) throw new Error(t('translation.invalidLoginId'))
  if (targetId.value == null) throw new Error(t('profile.notFound'))

  const [items, languages] = await Promise.all([
    getTranslationTargets(props.kind, accountId.value),
    getTranslationLanguages(),
  ])
  const item = items.find((item) => item.id === targetId.value)
  if (!item) throw new Error(t('profile.notFound'))
  return { item, languages }
}

const { state, refetch: reload } = useQuery({
  key: () => ['translation', 'multi', props.kind, accountId.value, targetId.value],
  query: load,
})

const item = computed(() => state.value.data?.item ?? null)
// The backend clears source/target while translation is off, so seed a usable
// pair. Seeding is keyed by target, not one-shot: changing the route query to
// another friend reuses this component, and a background refetch of the same
// target must not discard the user's edit.
let seededFor: number | null = null
watch(
  item,
  (value) => {
    const id = targetId.value
    if (!value || id == null || seededFor === id) return
    seededFor = id
    draft.value = initialLanguagePair(value.source, value.target)
    step.value = 'source'
    search.value = ''
    enabled.value = true
  },
  { immediate: true },
)

const options = computed(() =>
  createTranslationLanguageOptions(state.value.data?.languages ?? [], locale.value),
)
const visibleOptions = computed(() => filterTranslationLanguageOptions(options.value, search.value))
const selectedCode = computed(() =>
  step.value === 'source' ? draft.value.source : draft.value.target,
)
const otherCode = computed(() =>
  step.value === 'source' ? draft.value.target : draft.value.source,
)
const otherLabel = computed(() =>
  t(step.value === 'source' ? 'translation.target' : 'translation.source'),
)

function languageName(code: string): string {
  return options.value.find((option) => option.code === code)?.name ?? code
}

function selectLanguage(code: string): void {
  draft.value = pickLanguagePair(draft.value, step.value, code)
}

function swapLanguages(): void {
  draft.value = swapLanguagePair(draft.value)
}

function toggleEnabled(): void {
  enabled.value = !enabled.value
}

async function done(): Promise<void> {
  if (accountId.value == null || !item.value || saving.value) return

  saving.value = true
  try {
    const setting: TranslationSetting = enabled.value
      ? { skill: 3, source: draft.value.source, target: draft.value.target }
      : { skill: 0, source: '', target: '' }
    await changeTranslationTarget(props.kind, accountId.value, item.value.id, setting)
    await queryCache.invalidateQueries({ key: ['translation'] })
    goBack()
  } catch (error) {
    resultError.value = error instanceof Error ? error.message : String(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <PageHeader :title="item?.name ?? t('settings.title')" />

    <main class="px-4 pb-28 pt-4">
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

          <div class="mt-4 card">
            <div class="min-h-12 flex items-center justify-between text-body">
              <span>{{ t('translation.enableTranslation') }}</span>
              <button
                type="button"
                role="switch"
                class="relative h-7 w-12 flex-none rounded-full disabled:opacity-50"
                :class="enabled ? 'bg-primary' : 'bg-fill'"
                :aria-checked="enabled"
                :disabled="saving"
                :aria-label="t('translation.enableTranslation')"
                @click="toggleEnabled"
              >
                <span
                  class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                  :class="enabled ? 'right-0.5' : 'left-0.5'"
                />
              </button>
            </div>

            <div class="mt-4 flex items-center space-x-2" :class="{ 'opacity-50': !enabled }">
              <div class="min-w-0 flex-1 rounded-standard bg-surface-field px-3 py-2">
                <span class="block text-small text-text-secondary">{{
                  t('translation.source')
                }}</span>
                <span class="block truncate text-2nd-body font-medium">
                  {{ languageName(draft.source) }}
                </span>
              </div>

              <button
                type="button"
                class="h-10 w-10 flex flex-none items-center justify-center rounded-full bg-surface-muted text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                :aria-label="t('translation.swapLanguages')"
                :disabled="saving || !enabled"
                @click="swapLanguages"
              >
                <span class="i-ph-arrows-left-right" aria-hidden="true" />
              </button>

              <div class="min-w-0 flex-1 rounded-standard bg-surface-field px-3 py-2">
                <span class="block text-small text-text-secondary">{{
                  t('translation.target')
                }}</span>
                <span class="block truncate text-2nd-body font-medium">
                  {{ languageName(draft.target) }}
                </span>
              </div>
            </div>
          </div>

          <div class="mt-4 card overflow-hidden">
            <div class="flex rounded-standard bg-surface-muted p-1" role="tablist">
              <button
                v-for="tab in ['source', 'target'] as const"
                :key="tab"
                type="button"
                role="tab"
                class="h-10 flex-1 rounded-small text-2nd-body font-medium transition-colors"
                :class="
                  step === tab ? 'bg-surface-selected text-text-primary' : 'text-text-secondary'
                "
                :aria-selected="step === tab"
                :disabled="!enabled"
                @click="step = tab"
              >
                {{ t(`translation.${tab}`) }}
              </button>
            </div>

            <input
              v-model="search"
              type="search"
              name="translation-language-search"
              autocomplete="off"
              class="mt-4 h-11 w-full rounded-standard bg-surface-field px-4 text-2nd-body text-text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              :aria-label="t('translation.searchLanguages')"
              :placeholder="t('translation.searchLanguages')"
              :disabled="!enabled"
            />

            <p class="mt-4 text-2nd-body text-text-secondary">
              {{ t('translation.allLanguages') }}
            </p>

            <ul class="-mx-4 mt-2">
              <li v-for="option in visibleOptions" :key="option.code">
                <button
                  type="button"
                  class="min-h-14 w-full flex items-center rounded-standard px-4 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                  :class="
                    option.code === selectedCode ? 'bg-surface-selected' : 'active:bg-surface-muted'
                  "
                  :aria-pressed="option.code === selectedCode"
                  :disabled="!enabled"
                  @click="selectLanguage(option.code)"
                >
                  <span class="language-flag w-5 flex-none text-header" aria-hidden="true">
                    {{ option.flag }}
                  </span>
                  <span class="ml-2 min-w-0 flex-1">
                    <span class="block truncate text-2nd-body font-medium">{{ option.name }}</span>
                    <span class="block truncate text-small text-text-secondary">
                      {{ option.nativeName }}
                    </span>
                  </span>
                  <span
                    v-if="option.code === otherCode"
                    class="ml-2 flex-none text-small text-text-secondary"
                  >
                    {{ otherLabel }}
                  </span>
                </button>
              </li>
            </ul>

            <p
              v-if="visibleOptions.length === 0"
              class="py-8 text-center text-2nd-body text-text-secondary"
              role="status"
            >
              {{ t('translation.noLanguagesFound') }}
            </p>
          </div>
        </template>
      </QueryState>
    </main>

    <footer
      v-if="item"
      class="fixed inset-x-0 bottom-0 flex items-center space-x-3 bg-surface-elevated px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3"
    >
      <button
        v-if="enabled && step === 'target'"
        type="button"
        class="h-12 flex-none rounded-button bg-surface-muted px-5 text-header font-medium text-text-primary disabled:opacity-50"
        :disabled="saving"
        @click="step = 'source'"
      >
        {{ t('translation.previousStep') }}
      </button>
      <button
        v-if="enabled && step === 'source'"
        type="button"
        class="btn-primary"
        :disabled="saving"
        @click="step = 'target'"
      >
        {{ t('translation.nextStep') }}
      </button>
      <button v-else type="button" class="btn-primary" :disabled="saving" @click="done">
        {{ saving ? t('translation.saving') : t('translation.done') }}
      </button>
    </footer>

    <ResultModal
      v-if="resultError"
      type="error"
      :message="resultError"
      @close="resultError = null"
    />
  </div>
</template>

<style scoped>
.language-flag {
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
}
</style>
