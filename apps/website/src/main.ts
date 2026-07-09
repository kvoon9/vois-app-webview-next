import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from '~/App.vue'
import { i18n } from '~/i18n'
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'
import '~/styles/base.css'

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const app = createApp(App)
app.use(router)
app.use(i18n)
app.config.errorHandler = (err: unknown) => {
  console.error('[app.errorHandler]', err)
  // ponytail: global last-resort handler; ErrorBoundary onErrorCaptured catches per-route first
}
app.mount('#app')
