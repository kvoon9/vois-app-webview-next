import { enableDebugBridge } from '@vois/webview-bridge/debug'
import { PiniaColada } from '@pinia/colada'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from '~/App.vue'
import { i18n, SUPPORTED_LOCALES } from '~/i18n'
import { needsIntlPolyfill } from '~/i18n/intl-polyfill-needed'
import { isWebviewDebug } from '~/composables/useWebviewDebug'
import { markSessionStart } from '~/composables/usePageBack'
import { whenWebviewBridge } from '~/composables/useWebviewBridge'
import { deviceEntryTarget } from '~/utils/device-entry'
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'
import '~/styles/base.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// Leaves whatever the WebView host loaded before this document out of the
// back-button depth, so `goBack(2)` cannot pop into a host-owned page.
markSessionStart()

router.beforeEach((to) => {
  const target = deviceEntryTarget(to.path, to.query)
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
  if (isWebviewDebug()) enableDebugBridge()
  void whenWebviewBridge()

  try {
    if (needsIntlPolyfill(SUPPORTED_LOCALES)) await import('~/i18n/intl-polyfill')
  } catch (error) {
    console.error('[intl] polyfill failed to load', error)
  }
  // Mount only after the first route resolved: App.vue's usePageParams observes
  // route.path at setup, and observing START_LOCATION ('/') would send native a
  // page-params request for a page that is never shown.
  await router.isReady()
  app.mount('#app')
}

void mount()
