import { PiniaColada } from '@pinia/colada'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from '~/App.vue'
import { parseAccountId } from '~/composables/useAccountId'
import { i18n } from '~/i18n'
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'
import '~/styles/base.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// Native entry `/devices/groups/#/?device-user-id=xxx` lands on `/` because the
// pathname is invisible to hash routing; forward it to the device groups page.
router.beforeEach((to) => {
  const raw = to.query['device-user-id']
  const deviceUserId = Array.isArray(raw) ? raw[0] : raw
  if (
    to.path === '/' &&
    window.location.pathname.startsWith('/devices/groups') &&
    parseAccountId(deviceUserId) != null &&
    deviceUserId != null
  ) {
    const { 'device-user-id': _, ...query } = to.query
    return { path: `/devices/${deviceUserId}/groups`, query, replace: true }
  }
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
app.mount('#app')
