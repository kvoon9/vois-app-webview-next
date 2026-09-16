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
 * to the raw code. Low-end Intl builds omit `Locale`/`DisplayNames` entirely, so
 * every Intl call sits behind the try/catch instead of assuming the API exists.
 */
export function translationLanguageName(code: string, locale: string): string {
  return intlLanguageName(code, locale) ?? ENGLISH_LANGUAGE_NAMES.get(code) ?? code
}

function intlLanguageName(code: string, locale: string): string | null {
  if (!Intl.DisplayNames || !Intl.Locale) return null

  try {
    const codeLocale = new Intl.Locale(code)
    const languageName =
      new Intl.DisplayNames([locale], { type: 'language' }).of(codeLocale.language) ?? code
    const qualifier = displayLanguageQualifier(codeLocale, locale)
    if (!qualifier) return languageName

    const displayLanguage = new Intl.Locale(locale).language
    const spacing = ['zh', 'ja', 'ko'].includes(displayLanguage) ? '' : ' '
    return `${languageName}${spacing}(${qualifier})`
  } catch {
    return null
  }
}

function displayLanguageQualifier(codeLocale: Intl.Locale, locale: string): string {
  if (codeLocale.language === 'zh' && (codeLocale.script || codeLocale.region)) {
    const script = codeLocale.script ?? codeLocale.maximize().script
    if (script) return new Intl.DisplayNames([locale], { type: 'script' }).of(script) ?? ''
  }

  if (codeLocale.region) {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(codeLocale.region) ?? ''
  }
  if (codeLocale.script) {
    return new Intl.DisplayNames([locale], { type: 'script' }).of(codeLocale.script) ?? ''
  }
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
