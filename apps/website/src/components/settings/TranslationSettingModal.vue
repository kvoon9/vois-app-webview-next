<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseModal from '~/components/BaseModal.vue'
import LanguagePickerDrawer from '~/components/settings/LanguagePickerDrawer.vue'
import type {
  TranslationSetting,
  TranslationSkill,
  TranslationTarget,
} from '~/utils/translation-api'
import { translationLanguageSubtag } from '~/utils/translation-language'

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
const skill = shallowRef<TranslationSkill>(props.item.skill)
const source = shallowRef(props.item.source || 'zh-CN')
const target = shallowRef(props.item.target || 'en-US')

const modes = computed(() => [
  { skill: 0 as const, label: t('translation.skills.off') },
  { skill: 1 as const, label: t('translation.skills.basic') },
  { skill: 2 as const, label: t('translation.skills.premiumZhEn') },
  { skill: 3 as const, label: t('translation.skills.premiumMulti') },
])

const languageOptions = computed(() => {
  const languages = [...new Set(props.languages.filter(Boolean))]
  if (skill.value !== 2) return languages
  return languages.filter((code) => ['zh', 'en'].includes(translationLanguageSubtag(code)))
})

const showsLanguages = computed(() => props.memberOnly || skill.value >= 2)
const canConfirm = computed(
  () =>
    !props.saving &&
    (!showsLanguages.value ||
      (languageOptions.value.includes(source.value) &&
        languageOptions.value.includes(target.value) &&
        source.value !== target.value)),
)

function selectSkill(nextSkill: TranslationSkill): void {
  skill.value = nextSkill
  if (nextSkill === 0) {
    source.value = ''
    target.value = ''
    return
  }
  if (nextSkill === 1) {
    source.value = 'zh-CN'
    target.value = 'en-US'
    return
  }

  const options = languageOptions.value
  if (!options.includes(source.value)) source.value = options[0] ?? ''
  if (!options.includes(target.value) || target.value === source.value) {
    target.value = options.find((code) => code !== source.value) ?? ''
  }
}

function confirm(): void {
  if (!canConfirm.value) return

  let nextSource = ''
  let nextTarget = ''
  if (skill.value !== 0) {
    nextSource = showsLanguages.value ? source.value : 'zh-CN'
    nextTarget = showsLanguages.value ? target.value : 'en-US'
  }

  emit('confirm', {
    skill: skill.value,
    source: nextSource,
    target: nextTarget,
  })
}
</script>

<template>
  <BaseModal
    :title="
      $t(memberOnly ? 'translation.memberTitle' : 'translation.settingTitle', { name: item.name })
    "
    :dismissible="!saving"
    @cancel="$emit('cancel')"
  >
    <div v-if="!memberOnly" class="space-y-2" role="group" :aria-label="$t('translation.mode')">
      <button
        v-for="mode in modes"
        :key="mode.skill"
        type="button"
        class="min-h-11 w-full rounded-standard border px-4 text-left text-2nd-body transition-colors"
        :class="
          skill === mode.skill
            ? 'border-primary bg-surface-selected text-text-primary'
            : 'border-stroke bg-surface text-text-secondary'
        "
        :aria-pressed="skill === mode.skill"
        @click="selectSkill(mode.skill)"
      >
        {{ mode.label }}
      </button>
    </div>

    <div v-if="showsLanguages" :class="memberOnly ? 'space-y-4' : 'mt-4 space-y-4'">
      <LanguagePickerDrawer
        v-model="source"
        :label="$t('translation.source')"
        :languages="languageOptions"
        :title="$t('translation.translateFrom')"
      />
      <LanguagePickerDrawer
        v-model="target"
        :label="$t('translation.target')"
        :languages="languageOptions"
        :title="$t('translation.translateTo')"
      />

      <p v-if="source === target" class="text-small text-danger" role="alert">
        {{ $t('translation.languagesMustDiffer') }}
      </p>
    </div>

    <template #footer>
      <div class="flex justify-end space-x-3">
        <button
          type="button"
          class="rounded-small px-4 py-2 text-text-secondary focus-visible:ring-2 focus-visible:ring-primary/40"
          :disabled="saving"
          @click="$emit('cancel')"
        >
          {{ $t('modal.cancel') }}
        </button>
        <button
          type="button"
          class="rounded-small bg-primary px-4 py-2 text-primary-text focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          :disabled="!canConfirm"
          @click="confirm"
        >
          {{ saving ? $t('translation.saving') : $t('modal.confirm') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
