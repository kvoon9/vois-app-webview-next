// @env browser

import { useLocalStorage } from '@vueuse/core'

export const accessToken = useLocalStorage('access-token', '')
