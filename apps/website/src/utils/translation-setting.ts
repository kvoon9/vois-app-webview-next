import type { TranslationSetting, TranslationSkill } from '~/utils/translation-api'
import { translationLanguageSubtag } from '~/utils/translation-language'

/** The two fixed languages available when the user is in the Chinese-English skill (skill=2). */
export const ZH_EN_LANGUAGES: readonly string[] = ['zh-CN', 'en-US']

/**
 * Seed the multi-language editor from a stored setting. The backend clears the
 * pair while translation is off, so source/target need a fallback before the
 * user picks. `state` survives the seed because the page derives its enable
 * toggle from it.
 */
export function initialLanguagePair(setting: TranslationSetting): TranslationSetting {
  const from = setting.source || ZH_EN_LANGUAGES[0]
  const to = setting.target || ZH_EN_LANGUAGES[1]
  if (from !== to) return { ...setting, source: from, target: to }
  return { ...setting, source: from, target: from === 'zh-CN' ? 'en-US' : 'zh-CN' }
}

/**
 * Pure helpers shared between the inline profile editor and the modal-driven
 * member editor. Both surfaces need the same language normalization when the
 * user picks a different skill or swaps a source/target, so we keep the rules
 * here instead of duplicating the if/else ladder in each component.
 *
 * `nextSkill` 0 is the editors' off mode: off is a `state`, not a skill, and an
 * off row keeps both the skill the editor would switch back on with and the
 * language pair, so turning translation off does not lose the selection.
 */
export function nextSettingForSkill(
  current: TranslationSetting,
  nextSkill: TranslationSkill | 0,
  languageOptions: readonly string[],
): TranslationSetting | null {
  if (nextSkill === 0) {
    if (current.state === 0) return null
    return { state: 0, skill: 3, source: current.source, target: current.target }
  }
  if (current.state === 1 && current.skill === nextSkill) return null

  let { source, target } = current

  if (nextSkill === 1) {
    return { state: 1, skill: 1, source: 'zh-CN', target: 'en-US' }
  }
  if (nextSkill === 2) {
    source = translationLanguageSubtag(source) === 'en' ? 'en-US' : 'zh-CN'
    target = source === 'zh-CN' ? 'en-US' : 'zh-CN'
    return { state: 1, skill: 2, source, target }
  }

  const options = languageOptions.filter(Boolean)
  if (!options.includes(source)) source = options[0] ?? ''
  if (!options.includes(target) || target === source) {
    target = options.find((code) => code !== source) ?? ''
  }
  if (!source || !target) return null
  return { state: 1, skill: 3, source, target }
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
      ...current,
      source: value,
      target: value === current.target ? current.source : current.target,
    }
  }
  return {
    ...current,
    source: value === current.source ? current.target : current.source,
    target: value,
  }
}

export function swapLanguagePair(current: TranslationSetting): TranslationSetting {
  return { ...current, source: current.target, target: current.source }
}
