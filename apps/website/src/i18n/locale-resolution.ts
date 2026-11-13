import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from './config'

export interface LocaleSources {
  readonly native?: string | null
  readonly query?: string | null
  readonly stored?: string | null
  readonly browser?: string | null
}

/** Maps a BCP 47 tag onto a bundled catalog, including regional variants. */
export function matchLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) return null
  if (isSupportedLocale(value)) return value

  const tag = value.toLowerCase()
  if (tag.startsWith('zh')) return /(?:hant|tw|hk|mo)/.test(tag) ? 'zh-TW' : 'zh-CN'
  return tag.startsWith('en') ? 'en' : null
}

/** Native's answer wins; then an explicit link, the tab's choice, and the browser. */
export function resolveLocale(sources: LocaleSources): SupportedLocale {
  return (
    matchLocale(sources.native) ??
    matchLocale(sources.query) ??
    matchLocale(sources.stored) ??
    matchLocale(sources.browser) ??
    DEFAULT_LOCALE
  )
}
