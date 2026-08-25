// @env browser

import { useLocalStorage } from '@vueuse/core'

export const accessToken = useLocalStorage('access-token', '')

/** Shared upper bound for free-text feedback, report, and report-target forms. */
export const MAX_REPORT_CONTENT_LENGTH = 500
