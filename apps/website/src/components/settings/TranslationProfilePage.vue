<script setup lang="ts">
import { useAsyncState } from '@vueuse/core'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import PageHeader from '~/components/PageHeader.vue'
import ResultModal from '~/components/ResultModal.vue'
import LanguagePickerDrawer from '~/components/settings/LanguagePickerDrawer.vue'
import { getLoginId } from '~/utils/login-id'
import {
  changeTranslationTarget,
  getTranslationLanguages,
  getTranslationTargets,
  type TranslationSetting,
  type TranslationSkill,
  type TranslationTarget,
  type TranslationTargetKind,
} from '~/utils/translation-api'
import { translationLanguageSubtag } from '~/utils/translation-language'

const props = defineProps<{
  kind: TranslationTargetKind
}>()

const route = useRoute()
const { t } = useI18n({ useScope: 'global' })
const loginId = getLoginId()
const saving = shallowRef(false)
const resultError = shallowRef<string | null>(null)

const zhEnLanguages = ['zh-CN', 'en-US']

const targetId = computed(() => {
  const raw = route.params[props.kind === 'friends' ? 'id' : 'groupId']
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
})

async function load(): Promise<{ item: TranslationTarget | null; languages: string[] }> {
  if (loginId == null) throw new Error(t('translation.invalidLoginId'))
  if (targetId.value == null) throw new Error(t('profile.notFound'))

  const [items, languages] = await Promise.all([
    getTranslationTargets(props.kind, loginId),
    getTranslationLanguages(),
  ])
  return { item: items.find((item) => item.id === targetId.value) ?? null, languages }
}

const {
  state,
  isLoading,
  error,
  executeImmediate: reload,
} = useAsyncState(load, { item: null, languages: [] }, { resetOnExecute: false })

const errorMessage = computed(() => {
  if (error.value) return error.value instanceof Error ? error.value.message : String(error.value)
  if (!isLoading.value && !state.value.item) return t('profile.notFound')
  return ''
})

const item = computed(() => state.value.item)
const isZhEn = computed(() => item.value?.skill === 2)
const showsLanguages = computed(() => (item.value?.skill ?? 0) >= 2)

const modes = computed(() => [
  { skill: 0 as const, label: t('translation.skills.off') },
  { skill: 1 as const, label: t('translation.skills.basic') },
  { skill: 2 as const, label: t('translation.skills.premiumZhEn') },
  { skill: 3 as const, label: t('translation.skills.premiumMulti') },
])

const languageOptions = computed(() => {
  if (!item.value) return state.value.languages
  if (item.value.skill === 2) return zhEnLanguages
  return [
    ...new Set([...state.value.languages, item.value.source, item.value.target].filter(Boolean)),
  ]
})

async function save(setting: TranslationSetting): Promise<void> {
  if (loginId == null || !item.value || saving.value) return

  saving.value = true
  try {
    const updated = await changeTranslationTarget(props.kind, loginId, item.value.id, setting)
    state.value = { ...state.value, item: updated }
  } catch (error) {
    resultError.value = error instanceof Error ? error.message : String(error)
  } finally {
    saving.value = false
  }
}

function selectSkill(skill: TranslationSkill): void {
  if (!item.value || item.value.skill === skill) return

  let source = item.value.source
  let target = item.value.target

  if (skill === 0) {
    source = ''
    target = ''
  } else if (skill === 1) {
    source = 'zh-CN'
    target = 'en-US'
  } else if (skill === 2) {
    source = translationLanguageSubtag(source) === 'en' ? 'en-US' : 'zh-CN'
    target = source === 'zh-CN' ? 'en-US' : 'zh-CN'
  } else {
    const options = languageOptions.value
    if (!options.includes(source)) source = options[0] ?? ''
    if (!options.includes(target) || target === source) {
      target = options.find((code) => code !== source) ?? ''
    }
    if (!source || !target) return
  }

  save({ skill, source, target })
}

function swapLanguages(): void {
  if (!item.value) return
  save({ skill: item.value.skill, source: item.value.target, target: item.value.source })
}

function changeSource(source: string): void {
  if (!item.value) return
  // Picking the current target swaps the pair instead of saving an invalid same-language setting
  const target = source === item.value.target ? item.value.source : item.value.target
  save({ skill: item.value.skill, source, target })
}

function changeTarget(target: string): void {
  if (!item.value) return
  const source = target === item.value.source ? item.value.target : item.value.source
  save({ skill: item.value.skill, source, target })
}

function hideBrokenImage(event: Event): void {
  const image = event.currentTarget
  if (image instanceof HTMLImageElement) image.hidden = true
}
</script>

<template>
  <div class="min-h-screen min-h-svh bg-surface text-text-primary">
    <PageHeader :title="item?.name ?? $t('settings.title')" />

    <main class="p-4">
      <div v-if="isLoading && !item" class="py-12 text-center text-body text-text-secondary">
        {{ $t('translation.loading') }}
      </div>

      <div v-else-if="errorMessage && !item" class="py-12 text-center">
        <p class="text-body text-danger">{{ errorMessage }}</p>
        <button
          type="button"
          class="mt-4 rounded-small bg-primary px-4 py-2 text-primary-text"
          @click="reload()"
        >
          {{ $t('translation.retry') }}
        </button>
      </div>

      <template v-else-if="item">
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
            {{ $t('profile.userId', { id: item.number }) }}
          </span>
        </div>

        <!-- ponytail: media/location/notifications/remarks rows are UI-only placeholders per design; native owns these features -->
        <div class="mt-2 divide-y divide-stroke border border-stroke rounded-standard bg-surface">
          <div
            class="min-h-12 flex items-center justify-between px-4 text-body"
            aria-disabled="true"
          >
            {{ $t('profile.media') }}
            <span aria-hidden="true" class="text-text-secondary">›</span>
          </div>
          <div
            class="min-h-12 flex items-center justify-between px-4 text-body"
            aria-disabled="true"
          >
            {{ $t('profile.location') }}
            <span aria-hidden="true" class="text-text-secondary">›</span>
          </div>
        </div>

        <div class="mt-4 border border-stroke rounded-standard bg-surface p-4">
          <div class="space-y-2" role="group" :aria-label="$t('translation.mode')">
            <button
              v-for="mode in modes"
              :key="mode.skill"
              type="button"
              class="min-h-11 w-full rounded-standard border px-4 text-left text-2nd-body transition-colors"
              :class="
                item.skill === mode.skill
                  ? 'border-primary bg-surface-selected text-text-primary'
                  : 'border-stroke bg-surface text-text-secondary'
              "
              :aria-pressed="item.skill === mode.skill"
              :disabled="saving"
              @click="selectSkill(mode.skill)"
            >
              {{ mode.label }}
            </button>
          </div>

          <div v-if="showsLanguages" class="mt-4">
            <LanguagePickerDrawer
              :model-value="item.source"
              :disabled="saving || isZhEn"
              :label="$t('translation.translateFrom')"
              :languages="languageOptions"
              :title="$t('translation.translateFrom')"
              @update:model-value="changeSource"
            />

            <div class="my-2 flex justify-center">
              <button
                type="button"
                class="h-11 w-11 touch-manipulation flex items-center justify-center rounded-full bg-surface-muted text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                :aria-label="$t('translation.swapLanguages')"
                :disabled="saving"
                @click="swapLanguages"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m3 8 4-4 4 4" />
                  <path d="M7 4v16" />
                  <path d="m21 16-4 4-4-4" />
                  <path d="M17 20V4" />
                </svg>
              </button>
            </div>

            <LanguagePickerDrawer
              :model-value="item.target"
              :disabled="saving || isZhEn"
              :label="$t('translation.translateTo')"
              :languages="languageOptions"
              :title="$t('translation.translateTo')"
              @update:model-value="changeTarget"
            />
          </div>
        </div>

        <div class="mt-4 divide-y divide-stroke border border-stroke rounded-standard bg-surface">
          <div
            v-for="row in kind === 'friends'
              ? ['profile.muteNotifications', 'profile.readReceipts', 'profile.stickOnTop']
              : ['profile.muteNotifications', 'profile.readReceipts']"
            :key="row"
            class="min-h-12 flex items-center justify-between px-4 text-body"
            aria-disabled="true"
          >
            {{ $t(row) }}
            <span
              class="relative h-7 w-12 flex-none rounded-full bg-surface-muted"
              aria-hidden="true"
            >
              <span class="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow" />
            </span>
          </div>
          <div
            class="min-h-12 flex items-center justify-between px-4 text-body"
            aria-disabled="true"
          >
            {{ $t('profile.editRemarks') }}
            <span aria-hidden="true" class="text-text-secondary">›</span>
          </div>
        </div>

        <RouterLink
          v-if="kind === 'groups'"
          :to="{ path: `/settings/groups/${item.id}/members`, query: { name: item.name } }"
          class="mt-4 min-h-12 flex items-center justify-between border border-stroke rounded-standard bg-surface px-4 text-body"
        >
          {{ $t('profile.members') }}
          <span aria-hidden="true" class="text-text-secondary">›</span>
        </RouterLink>

        <div class="mt-4 divide-y divide-stroke border border-stroke rounded-standard bg-surface">
          <div class="min-h-12 flex items-center px-4 text-body" aria-disabled="true">
            {{ $t('profile.clearHistory') }}
          </div>
          <RouterLink
            :to="{
              path: kind === 'friends' ? '/report-user' : '/report-group',
              query: { id: item.id },
            }"
            class="min-h-12 flex items-center px-4 text-body text-danger"
          >
            {{ $t('profile.report') }}
          </RouterLink>
          <div class="min-h-12 flex items-center px-4 text-body text-danger" aria-disabled="true">
            {{ $t(kind === 'friends' ? 'profile.block' : 'profile.exitGroup') }}
          </div>
        </div>
      </template>
    </main>

    <ResultModal
      v-if="resultError"
      type="error"
      :message="resultError"
      @close="resultError = null"
    />
  </div>
</template>
