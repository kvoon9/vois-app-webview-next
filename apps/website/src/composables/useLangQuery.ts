import { useSessionStorage } from '@vueuse/core'
import { useRouteQuery } from '@vueuse/router'
import { watch } from 'vue'

import { DEFAULT_LOCALE, i18n, isSupportedLocale, type SupportedLocale } from '~/i18n'
import { nativeLang } from '~/constants'

/**
 * The route query describes this navigation, native describes the app it was
 * opened from; the launch query is only the older copy of the same answer.
 */
export function useLangQuery(): void {
  const launchLang = new URLSearchParams(window.location.search).get('lang')
  const lang = useRouteQuery<string | null>('lang')
  const storedLocale = useSessionStorage<SupportedLocale>('locale', DEFAULT_LOCALE)

  watch(
    [lang, nativeLang],
    ([value, fromNative]) => {
      const requestedLocale = value || fromNative || launchLang
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
