import { ENGLISH_LANGUAGE_NAMES } from '~/i18n/language-names'

export interface TranslationLanguageOption {
  code: string
  flag: string
  name: string
  nativeName: string
}

export function createTranslationLanguageOptions(
  codes: string[],
  displayLocale: string,
): TranslationLanguageOption[] {
  return [...new Set(codes.filter(Boolean))].map((code) => ({
    code,
    flag: localeFlag(code),
    name: translationLanguageName(code, displayLocale),
    nativeName: translationLanguageName(code, code),
  }))
}

export function filterTranslationLanguageOptions(
  options: TranslationLanguageOption[],
  query: string,
): TranslationLanguageOption[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return options

  return options.filter(({ code, name, nativeName }) =>
    `${code} ${name} ${nativeName}`.toLocaleLowerCase().includes(needle),
  )
}

export function translationLanguageSubtag(code: string): string {
  try {
    return new Intl.Locale(code).language
  } catch {
    return code.split(/[-_]/)[0].toLocaleLowerCase()
  }
}

/**
 * Localized language name, falling back to the static English name and finally
 * to the raw code. Low-end Intl builds fail in two ways: the constructors can be
 * missing entirely, and Android WebViews can ship them without any ICU data, so
 * `of()` hands the code back instead of a name. `fallback: 'none'` turns that
 * echo into `undefined`, which is what lands here in the table. The polyfill in
 * `~/i18n/intl-polyfill` normally beats both cases to it.
 */
export function translationLanguageName(code: string, locale: string): string {
  return intlLanguageName(code, locale) ?? ENGLISH_LANGUAGE_NAMES.get(code) ?? code
}

function intlLanguageName(code: string, locale: string): string | null {
  if (!Intl.DisplayNames || !Intl.Locale) return null

  try {
    const codeLocale = new Intl.Locale(code)
    const languageName = displayName('language', codeLocale.language, locale)
    if (!languageName) return null

    const qualifier = displayLanguageQualifier(codeLocale, locale)
    // `null` says the engine has the API but not the data for it; the table
    // holds the full name, so don't settle for a partial one.
    if (qualifier === null) return null
    if (!qualifier) return languageName

    const displayLanguage = new Intl.Locale(locale).language
    const spacing = ['zh', 'ja', 'ko'].includes(displayLanguage) ? '' : ' '
    return `${languageName}${spacing}(${qualifier})`
  } catch {
    return null
  }
}

/**
 * `fallback: 'none'` is what makes a data-less engine answer `undefined` instead
 * of echoing the code back, so the caller knows to use its own table.
 */
function displayName(
  type: 'language' | 'region' | 'script',
  code: string,
  locale: string,
): string | null {
  return new Intl.DisplayNames([locale], { type, fallback: 'none' }).of(code) ?? null
}

/** Returns `null` when the engine knows the subtag but cannot name it. */
function displayLanguageQualifier(codeLocale: Intl.Locale, locale: string): string | null {
  if (codeLocale.language === 'zh' && (codeLocale.script || codeLocale.region)) {
    const script = codeLocale.script ?? codeLocale.maximize().script
    if (script) return displayName('script', script, locale)
  }

  if (codeLocale.region) return displayName('region', codeLocale.region, locale)
  if (codeLocale.script) return displayName('script', codeLocale.script, locale)
  return ''
}

/** Regional-indicator flag for the code's region subtag, no Intl required. */
function localeFlag(code: string): string {
  const region = localeRegion(code)
  if (!region || !/^[A-Z]{2}$/.test(region)) return '🌐'

  return String.fromCodePoint(region.charCodeAt(0) + 127397, region.charCodeAt(1) + 127397)
}

function localeRegion(code: string): string | null {
  try {
    return new Intl.Locale(code).region?.toUpperCase() ?? null
  } catch {
    // A two-letter second subtag is the region; anything else (`zh-Hans`) is not.
    const subtag = code.split(/[-_]/)[1]
    return subtag && /^[A-Za-z]{2}$/.test(subtag) ? subtag.toUpperCase() : null
  }
}
