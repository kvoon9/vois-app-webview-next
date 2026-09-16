import { PiniaColada } from '@pinia/colada'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from '~/App.vue'
import { i18n } from '~/i18n'
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
app.mount('#app')
