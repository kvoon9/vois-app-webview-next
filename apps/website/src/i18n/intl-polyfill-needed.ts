/**
 * Chromium on Android ships `Intl.DisplayNames` without the ICU data behind it,
 * so `of()` has nothing to look up and hands back the code it was given. No
 * throw, no `undefined` (https://issues.chromium.org/issues/40701339). A trimmed
 * ROM can also keep English data and drop the rest, which is why every UI locale
 * is checked instead of assuming one engine-wide answer.
 *
 * Callers use this to decide whether to load `./intl-polyfill`. This module must
 * stay free of any polyfill import: it runs on every boot.
 */
export function needsIntlPolyfill(locales: readonly string[]): boolean {
  if (!Intl.DisplayNames || !Intl.Locale) return true

  return locales.some(displayNamesLacksIcuData)
}

function displayNamesLacksIcuData(locale: string): boolean {
  try {
    const names = (type: 'language' | 'region' | 'script') =>
      new Intl.DisplayNames([locale], { type })

    // Codes the app really looks up; a healthy engine never echoes them back.
    return (
      names('language').of('fr') === 'fr' ||
      names('region').of('CA') === 'CA' ||
      names('script').of('Hant') === 'Hant'
    )
  } catch {
    return true
  }
}
