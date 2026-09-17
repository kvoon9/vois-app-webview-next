<script setup lang="ts">
import { useQuery, useQueryCache } from '@pinia/colada'
import { useWindowScroll } from '@vueuse/core'
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

const prefix = props.kind === 'friends' ? 'friend' : 'group'
const idQuery = useRouteQuery<string | null>(`${prefix}-id`)
const targetId = computed(() => parseAccountId(idQuery.value))

// Native sends the target's type and skill. Only skill 3 (multilingual) and
// skill 0 (translation off) are edited here; the Chinese-English skills have
// their own editor. A missing param is not treated as 0, so callers that
// ignore this contract get the tip.
const typeQuery = useRouteQuery<string | null>(`${prefix}-type`)
const skillQuery = useRouteQuery<string | null>(`${prefix}-skill`)
const supported = computed(() => {
  if (skillQuery.value == null) return false
  const skill = Number(skillQuery.value)
  return skill === 0 || skill === 3
})
const title = computed(() =>
  Number(typeQuery.value) === 2 ? t('translation.aiTitle') : t('settings.title'),
)

const step = shallowRef<'source' | 'target'>('source')
const search = shallowRef('')
const saving = shallowRef(false)
const resultError = shallowRef<string | null>(null)
const draft = shallowRef<TranslationSetting>({ skill: 3, source: 'zh-CN', target: 'en-US' })

// The toggle and the setting are the same fact: skill 0 is off. Deriving it from
// the draft keeps a reopened page showing the stored skill instead of drifting.
const enabled = computed(() => draft.value.skill !== 0)

// The language list runs past 100 rows, so a tap beats a long flick back. The
// offset clears the fixed footer instead of sitting under it.
const BACK_TO_TOP_THRESHOLD = 600

const { y: scrollY } = useWindowScroll()
const showBackToTop = computed(() => scrollY.value > BACK_TO_TOP_THRESHOLD)

function backToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

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
  enabled: supported,
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
    draft.value = initialLanguagePair(value)
    step.value = 'source'
    search.value = ''
  },
  { immediate: true },
)

const options = computed(() =>
  createTranslationLanguageOptions(state.value.data?.languages ?? [], locale.value),
)
const visibleOptions = computed(() => filterTranslationLanguageOptions(options.value, search.value))
// The pair doubles as the tab list, so render both sides from one shape.
const sides = computed(() => [
  { key: 'source' as const, code: draft.value.source },
  { key: 'target' as const, code: draft.value.target },
])
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

function languageFlag(code: string): string {
  return options.value.find((option) => option.code === code)?.flag ?? '🌐'
}

function selectLanguage(code: string): void {
  draft.value = pickLanguagePair(draft.value, step.value, code)
}

function swapLanguages(): void {
  draft.value = swapLanguagePair(draft.value)
}

// The wire payload for off always clears the pair, mirroring what the backend
// does when translation is turned off.
function settingForDraft(draft: TranslationSetting): TranslationSetting {
  return draft.skill === 0 ? { skill: 0, source: '', target: '' } : { ...draft, skill: 3 }
}

async function save(draft: TranslationSetting): Promise<boolean> {
  if (accountId.value == null || !item.value || saving.value) return false

  saving.value = true
  resultError.value = null
  try {
    await changeTranslationTarget(
      props.kind,
      accountId.value,
      item.value.id,
      settingForDraft(draft),
    )
    await queryCache.invalidateQueries({ key: ['translation'] })
    return true
  } catch (error) {
    resultError.value = error instanceof Error ? error.message : String(error)
    return false
  } finally {
    saving.value = false
  }
}

// The toggle is a setting of its own, so it persists on the spot instead of
// waiting for the footer button.
async function toggleEnabledAndSave(): Promise<void> {
  const next = { ...draft.value, skill: enabled.value ? 0 : 3 }
  draft.value = next
  await save(next)
}

async function done(): Promise<void> {
  if (await save(draft.value)) goBack()
}
</script>

<template>
  <div class="page">
    <PageHeader :title="title" />

    <main class="px-4 pb-28 pt-4">
      <p v-if="!supported" class="py-12 text-center text-body text-text-secondary" role="status">
        {{ t('translation.unsupported') }}
      </p>

      <QueryState v-else :status="state.status" :error="state.error" @retry="reload()">
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
                @click="toggleEnabledAndSave"
              >
                <span
                  class="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                  :class="enabled ? 'right-0.5' : 'left-0.5'"
                />
              </button>
            </div>

            <!-- The pair is the tab switcher: the highlighted card decides which
                 side the language list below edits, so no separate tab bar. -->
            <div class="mt-4 flex items-center space-x-2" :class="{ 'opacity-50': !enabled }">
              <template v-for="(side, index) in sides" :key="side.key">
                <button
                  type="button"
                  class="min-w-0 flex-1 rounded-standard px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                  :class="
                    step === side.key
                      ? 'bg-primary text-primary-text'
                      : 'bg-surface-field text-text-primary'
                  "
                  :aria-pressed="step === side.key"
                  :disabled="!enabled"
                  @click="step = side.key"
                >
                  <span
                    class="block text-small"
                    :class="step === side.key ? 'opacity-80' : 'text-text-secondary'"
                  >
                    {{ t(`translation.${side.key}`) }}
                  </span>
                  <span class="flex items-center">
                    <span class="language-flag w-5 flex-none text-header" aria-hidden="true">
                      {{ languageFlag(side.code) }}
                    </span>
                    <span class="ml-1.5 min-w-0 truncate text-2nd-body font-medium">
                      {{ languageName(side.code) }}
                    </span>
                  </span>
                </button>

                <button
                  v-if="index === 0"
                  type="button"
                  class="h-10 w-10 flex flex-none items-center justify-center rounded-full bg-surface-muted text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                  :aria-label="t('translation.swapLanguages')"
                  :disabled="saving || !enabled"
                  @click="swapLanguages"
                >
                  <span class="i-ph-arrows-left-right" aria-hidden="true" />
                </button>
              </template>
            </div>
          </div>

          <div class="mt-4 card overflow-hidden">
            <input
              v-model="search"
              type="search"
              name="translation-language-search"
              autocomplete="off"
              class="h-11 w-full rounded-standard bg-surface-field px-4 text-2nd-body text-text-primary outline-none opacity-75 transition-opacity focus-visible:opacity-100"
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

    <button
      v-if="showBackToTop"
      type="button"
      class="fab fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]"
      :aria-label="t('nav.backToTop')"
      @click="backToTop"
    >
      <span class="i-ph-arrow-up" aria-hidden="true" />
    </button>

    <footer
      v-if="supported && item"
      class="fixed inset-x-0 bottom-0 flex items-center space-x-3 bg-surface-elevated px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3"
    >
      <button type="button" class="btn-primary" :disabled="saving" @click="done">
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
