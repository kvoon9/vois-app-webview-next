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

export function translationLanguageName(code: string, locale: string): string {
  if (!Intl.DisplayNames) return code

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
    return code
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

function localeFlag(code: string): string {
  try {
    const region = new Intl.Locale(code).region?.toUpperCase()
    if (!region || !/^[A-Z]{2}$/.test(region)) return '🌐'

    return String.fromCodePoint(region.charCodeAt(0) + 127397, region.charCodeAt(1) + 127397)
  } catch {
    return '🌐'
  }
}
