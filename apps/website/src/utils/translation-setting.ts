import type { TranslationSetting, TranslationSkill } from '~/utils/translation-api'
import { translationLanguageSubtag } from '~/utils/translation-language'

/** The two fixed languages available when the user is in the Chinese-English skill (skill=2). */
export const ZH_EN_LANGUAGES: readonly string[] = ['zh-CN', 'en-US']

/**
 * Pure helpers shared between the inline profile editor and the modal-driven
 * member editor. Both surfaces need the same language normalization when the
 * user picks a different skill or swaps a source/target, so we keep the rules
 * here instead of duplicating the if/else ladder in each component.
 */
export function nextSettingForSkill(
  current: TranslationSetting,
  nextSkill: TranslationSkill,
  languageOptions: readonly string[],
): TranslationSetting | null {
  if (current.skill === nextSkill) return null

  let { source, target } = current

  if (nextSkill === 0) {
    return { skill: 0, source: '', target: '' }
  }
  if (nextSkill === 1) {
    return { skill: 1, source: 'zh-CN', target: 'en-US' }
  }
  if (nextSkill === 2) {
    source = translationLanguageSubtag(source) === 'en' ? 'en-US' : 'zh-CN'
    target = source === 'zh-CN' ? 'en-US' : 'zh-CN'
    return { skill: 2, source, target }
  }

  const options = languageOptions.filter(Boolean)
  if (!options.includes(source)) source = options[0] ?? ''
  if (!options.includes(target) || target === source) {
    target = options.find((code) => code !== source) ?? ''
  }
  if (!source || !target) return null
  return { skill: 3, source, target }
}

/**
 * Picking the current target as the new source (or vice versa) would create
 * a same-language pair, so swap the two values instead of saving as-is.
 */
export function pickLanguagePair(
  current: TranslationSetting,
  field: 'source' | 'target',
  value: string,
): TranslationSetting {
  if (field === 'source') {
    return {
      skill: current.skill,
      source: value,
      target: value === current.target ? current.source : current.target,
    }
  }
  return {
    skill: current.skill,
    source: value === current.source ? current.target : current.source,
    target: value,
  }
}

export function swapLanguagePair(current: TranslationSetting): TranslationSetting {
  return { skill: current.skill, source: current.target, target: current.source }
}
