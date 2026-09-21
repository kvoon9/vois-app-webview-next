<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '~/components/BaseModal.vue'
import LanguagePickerDrawer from '~/components/settings/LanguagePickerDrawer.vue'
import { nextSettingForSkill, swapLanguagePair, ZH_EN_LANGUAGES } from '~/utils/translation-setting'
import type {
  TranslationSetting,
  TranslationSkill,
  TranslationState,
  TranslationTarget,
} from '~/utils/translation-api'

const props = withDefaults(
  defineProps<{
    item: TranslationTarget
    languages: string[]
    memberOnly?: boolean
    saving?: boolean
  }>(),
  {
    memberOnly: false,
    saving: false,
  },
)

const emit = defineEmits<{
  cancel: []
  confirm: [setting: TranslationSetting]
}>()

const { t } = useI18n({ useScope: 'global' })
const state = shallowRef<TranslationState>(props.item.state)
const skill = shallowRef<TranslationSkill>(props.item.skill)
const source = shallowRef(props.item.source || 'zh-CN')
const target = shallowRef(props.item.target || 'en-US')

const modes = computed(() => [
  { state: 0 as const, skill: 3 as const, label: t('translation.skills.off') },
  { state: 1 as const, skill: 1 as const, label: t('translation.skills.basic') },
  { state: 1 as const, skill: 2 as const, label: t('translation.skills.premiumZhEn') },
  { state: 1 as const, skill: 3 as const, label: t('translation.skills.premiumMulti') },
])

const languageOptions = computed(() => {
  if (skill.value === 2) return [...ZH_EN_LANGUAGES]
  return [...new Set([...props.languages, source.value, target.value].filter(Boolean))]
})

const isZhEn = computed(() => state.value === 1 && skill.value === 2)
const showsLanguages = computed(() => props.memberOnly || (state.value === 1 && skill.value !== 1))
const canConfirm = computed(
  () =>
    !props.saving &&
    (!showsLanguages.value ||
      (languageOptions.value.includes(source.value) &&
        languageOptions.value.includes(target.value) &&
        source.value !== target.value)),
)

function isSelected(mode: { state: TranslationState; skill: TranslationSkill }): boolean {
  return state.value === mode.state && skill.value === mode.skill
}

function selectMode(mode: { state: TranslationState; skill: TranslationSkill }): void {
  const current = {
    state: state.value,
    skill: skill.value,
    source: source.value,
    target: target.value,
  }
  state.value = mode.state
  skill.value = mode.skill
  const next = nextSettingForSkill(
    current,
    mode.state === 0 ? 0 : mode.skill,
    languageOptions.value,
  )
  if (next) {
    source.value = next.source
    target.value = next.target
  }
}

if (!props.memberOnly && (state.value === 0 || skill.value !== 3)) {
  selectMode({ state: state.value, skill: skill.value })
}

function swapLanguages(): void {
  const swapped = swapLanguagePair({
    state: state.value,
    skill: skill.value,
    source: source.value,
    target: target.value,
  })
  source.value = swapped.source
  target.value = swapped.target
}

function confirm(): void {
  if (!canConfirm.value) return

  let nextSource = ''
  let nextTarget = ''
  if (props.memberOnly || state.value === 1) {
    nextSource = showsLanguages.value ? source.value : 'zh-CN'
    nextTarget = showsLanguages.value ? target.value : 'en-US'
  }

  emit('confirm', {
    state: state.value,
    skill: skill.value,
    source: nextSource,
    target: nextTarget,
  })
}
</script>

<template>
  <BaseModal :title="t('settings.title')" :dismissible="!saving" @cancel="$emit('cancel')">
    <div v-if="!memberOnly" class="space-y-2" role="group" :aria-label="t('translation.mode')">
      <button
        v-for="mode in modes"
        :key="mode.label"
        type="button"
        class="min-h-11 w-full rounded-standard px-4 text-left text-2nd-body transition-colors"
        :class="
          isSelected(mode)
            ? 'bg-surface-selected text-text-primary'
            : 'bg-surface-muted text-text-secondary'
        "
        :aria-pressed="isSelected(mode)"
        :disabled="saving"
        @click="selectMode(mode)"
      >
        {{ mode.label }}
      </button>
    </div>

    <div v-if="showsLanguages" :class="{ 'mt-4': !memberOnly }">
      <LanguagePickerDrawer
        v-model="source"
        :disabled="saving || isZhEn"
        :label="t('translation.source')"
        :languages="languageOptions"
        :title="t('translation.translateFrom')"
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
        v-model="target"
        :disabled="saving || isZhEn"
        :label="t('translation.target')"
        :languages="languageOptions"
        :title="t('translation.translateTo')"
      />

      <p v-if="source === target" class="mt-2 text-small text-danger" role="alert">
        {{ t('translation.languagesMustDiffer') }}
      </p>
    </div>

    <template #footer>
      <div class="flex space-x-3">
        <button
          type="button"
          class="modal-action bg-surface-field text-text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          :disabled="saving"
          @click="$emit('cancel')"
        >
          {{ t('modal.cancel') }}
        </button>
        <button
          type="button"
          class="modal-action bg-primary text-primary-text focus-visible:ring-2 focus-visible:ring-primary/40"
          :disabled="!canConfirm"
          @click="confirm"
        >
          {{ saving ? t('translation.saving') : t('modal.confirm') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
