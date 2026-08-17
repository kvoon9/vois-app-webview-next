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
    name: displayLanguageName(code, displayLocale),
    nativeName: displayLanguageName(code, code),
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
    return code.toLocaleLowerCase()
  }
}

function displayLanguageName(code: string, locale: string): string {
  if (!Intl.DisplayNames) return code

  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
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
