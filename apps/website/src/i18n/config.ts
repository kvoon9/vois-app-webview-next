export const DEFAULT_LOCALE = 'en' as const
export const SUPPORTED_LOCALES = ['en', 'zh-CN', 'zh-TW'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export function isSupportedLocale(locale: string | null | undefined): locale is SupportedLocale {
  return SUPPORTED_LOCALES.some((supported) => supported === locale)
}
