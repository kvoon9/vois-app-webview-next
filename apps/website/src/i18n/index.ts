import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'

export const DEFAULT_LOCALE = 'en' as const
export const SUPPORTED_LOCALES = ['en', 'zh-CN', 'zh-TW'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const messages = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
}

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages,
})
