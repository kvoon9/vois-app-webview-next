import { useSessionStorage } from '@vueuse/core'
import { watch } from 'vue'

import { DEFAULT_LOCALE, i18n, isSupportedLocale, type SupportedLocale } from '~/i18n'
import { nativeLang } from '~/constants'

/** Native's language wins; the stored locale is the fallback once it says nothing usable. */
export function useLangQuery(): void {
  const storedLocale = useSessionStorage<SupportedLocale>('locale', DEFAULT_LOCALE)

  watch(
    nativeLang,
    (fromNative) => {
      const locale = isSupportedLocale(fromNative)
        ? fromNative
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
