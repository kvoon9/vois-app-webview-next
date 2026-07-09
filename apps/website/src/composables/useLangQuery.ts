import { useRouteQuery } from '@vueuse/router'
import { watch } from 'vue'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, i18n, type SupportedLocale } from '~/i18n'

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale)
}

export function useLangQuery(): void {
  const lang = useRouteQuery('lang', DEFAULT_LOCALE as string)

  // URL query -> i18n locale
  watch(
    lang,
    (value) => {
      const locale = isSupportedLocale(value) ? value : DEFAULT_LOCALE
      // Normalize invalid query values back to the default locale
      if (lang.value !== locale) {
        lang.value = locale
        return
      }
      if (i18n.global.locale.value !== locale) {
        i18n.global.locale.value = locale
      }
    },
    { immediate: true },
  )

  // i18n locale -> URL query
  watch(
    () => i18n.global.locale.value,
    (locale) => {
      if (lang.value !== locale) {
        lang.value = locale
      }
    },
  )
}
