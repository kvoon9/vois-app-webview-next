// @env browser

import { useLocalStorage } from '@vueuse/core'
import { shallowRef } from 'vue'

export const accessToken = useLocalStorage('access-token', '')

/**
 * Native's own UI settings, as last reported over `get-page-params`. Module state
 * because native answers a page, while the app shell and i18n setup read them.
 */
export const nativeTheme = shallowRef<string | null>(null)
export const nativeLang = shallowRef<string | null>(null)

/** Shared upper bound for free-text feedback, report, and report-target forms. */
export const MAX_REPORT_CONTENT_LENGTH = 500
