import { setGlobalConfig } from 'valibot'
import { createI18n } from 'vue-i18n'
import { watch } from 'vue'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'

// Load Valibot i18n translations as side effects.
// English is Valibot's built-in default, so no separate import is required.
import '@valibot/i18n/zh-CN'
import '@valibot/i18n/zh-TW'

export const DEFAULT_LOCALE = 'en' as const
export const SUPPORTED_LOCALES = ['en', 'zh-CN', 'zh-TW'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const messages = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
}

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale)
}

function syncValibotLocale(locale: string): void {
  if (isSupportedLocale(locale)) {
    setGlobalConfig({ lang: locale })
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages,
})

// Keep Valibot's validation language in sync with the app's active locale.
syncValibotLocale(i18n.global.locale.value)
watch(() => i18n.global.locale.value, syncValibotLocale)
