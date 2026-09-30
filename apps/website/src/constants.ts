// @env browser

import { shallowRef } from 'vue'

/**
 * Native's own UI settings, as last reported over `get-page-params`. Module state
 * because native answers a page, while the app shell and i18n setup read them.
 */
export const nativeTheme = shallowRef<string | null>(null)
export const nativeLang = shallowRef<string | null>(null)
