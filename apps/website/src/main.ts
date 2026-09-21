import { PiniaColada } from '@pinia/colada'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from '~/App.vue'
import { i18n, SUPPORTED_LOCALES } from '~/i18n'
import { needsIntlPolyfill } from '~/i18n/intl-polyfill-needed'
import { deviceGroupsEntryTarget } from '~/utils/device-groups-entry'
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'
import '~/styles/base.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  const target = deviceGroupsEntryTarget(to.path, to.query)
  return target ? { ...target, replace: true } : undefined
})

const app = createApp(App)
app.use(router)
app.use(i18n)
app.use(createPinia())
app.use(PiniaColada)
app.config.errorHandler = (err) => {
  console.error('[app.errorHandler]', err)
  // ponytail: global last-resort handler; ErrorBoundary onErrorCaptured catches per-route first
}

/**
 * The polyfill swaps out `Intl.Locale`/`Intl.DisplayNames` globally, so it has to
 * land before anything renders a language name. A failed chunk must not block the
 * boot: `translation-language.ts` falls back to its own table on its own.
 */
async function mount(): Promise<void> {
  try {
    if (needsIntlPolyfill(SUPPORTED_LOCALES)) await import('~/i18n/intl-polyfill')
  } catch (error) {
    console.error('[intl] polyfill failed to load', error)
  }
  app.mount('#app')
}

void mount()
