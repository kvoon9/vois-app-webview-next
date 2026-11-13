import { useSessionStorage } from '@vueuse/core'
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { i18n, isSupportedLocale, type SupportedLocale } from '~/i18n'
import { resolveLocale } from '~/i18n/locale-resolution'
import { nativeLang } from '~/constants'

/** Native's language wins; the URL, the tab's choice and the browser are the fallbacks. */
export function useLangQuery(): void {
  const storedLocale = useSessionStorage<SupportedLocale | null>('locale', null, {
    // Reads both the old plain-string value and a JSON-quoted one, so a tab
    // that chose a language before this change keeps it.
    serializer: {
      read: (raw) => {
        try {
          const value = raw.startsWith('"') ? JSON.parse(raw) : raw
          return isSupportedLocale(value) ? value : null
        } catch {
          return null
        }
      },
      write: (value) => value ?? '',
    },
  })
  const route = useRoute()

  const hashLang = route.query.lang
  let queryLocale: string | null =
    (Array.isArray(hashLang) ? hashLang[0] : hashLang) ??
    new URLSearchParams(location.search).get('lang')

  watch(
    () => [nativeLang.value, storedLocale.value] as const,
    ([native, stored]) => {
      const locale = resolveLocale({
        native,
        query: queryLocale,
        stored,
        browser: navigator.language,
      })
      // A link seeds the first render only; later changes come from native or the picker.
      queryLocale = null
      if (i18n.global.locale.value !== locale) i18n.global.locale.value = locale
    },
    { immediate: true },
  )

  watch(
    () => i18n.global.locale.value,
    (locale) => {
      if (!isSupportedLocale(locale)) return
      if (storedLocale.value !== locale) storedLocale.value = locale
      document.documentElement.lang = locale
      document.title = i18n.global.t('app.title')
    },
    { immediate: true },
  )
}
