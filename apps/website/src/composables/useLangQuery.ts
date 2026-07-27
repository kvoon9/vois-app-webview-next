import { useSessionStorage } from '@vueuse/core'
import { useRouteQuery } from '@vueuse/router'
import { watch } from 'vue'

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, i18n, type SupportedLocale } from '~/i18n'

function isSupportedLocale(value: unknown): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale)
}

export function useLangQuery(): void {
  const launchLang = new URLSearchParams(window.location.search).get('lang')
  const lang = useRouteQuery('lang')
  const storedLocale = useSessionStorage<SupportedLocale>('locale', DEFAULT_LOCALE)

  watch(
    lang,
    (value) => {
      const requestedLocale = value || launchLang
      const locale = isSupportedLocale(requestedLocale)
        ? requestedLocale
        : isSupportedLocale(storedLocale.value)
          ? storedLocale.value
          : DEFAULT_LOCALE

      if (i18n.global.locale.value !== locale) i18n.global.locale.value = locale
    },
    { immediate: true },
  )

  watch(
    () => i18n.global.locale.value,
    (locale) => {
      if (isSupportedLocale(locale) && storedLocale.value !== locale) storedLocale.value = locale
    },
    { immediate: true },
  )
}
