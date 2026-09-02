import { defineConfig, loadEnv } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import legacy from '@vitejs/plugin-legacy'
import VueRouter from 'vue-router/vite'
import vueDevtools from 'vite-plugin-vue-devtools'
import { debugAuthPlugin } from './plugins/debug-auth.ts'
import { vconsoleDev } from './plugins/vconsole-dev.ts'

export default defineConfig(({ isPreview, command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiTarget = env.VITE_API_TARGET || 'https://api.voischat.cn'

  // .env is gitignored, so CI must inject these via secrets; fail loudly instead of
  // shipping a bundle where appid/sign silently become "undefined" (errcode 31)
  if (command === 'build') {
    if (!env.VITE_APP_ID || !env.VITE_APP_KEY) {
      throw new Error('VITE_APP_ID and VITE_APP_KEY are required for build (see .env.example)')
    }
  }

  return {
    base: './',
    server: {
      host: true,
      port: 3021,
      forwardConsole: true,
      proxy: {
        '/v2': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: 5173,
      proxy: {
        '/v2': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      ...(isPreview ? [vconsoleDev()] : []),
      ...(!isPreview || process.argv.includes('--debug') ? [debugAuthPlugin()] : []),
      vueDevtools(),
      VueRouter({ dts: 'src/route-map.d.ts' }),
      vue({
        // Enable Vapor Mode globally for <script setup> SFCs without per-file vapor marker.
        // Available in Vue 3.6+ and @vitejs/plugin-vue@6.0.8+
        features: {
          vapor: true,
        },
      }),
      unocss(),
      legacy({
        targets: ['chrome 83'],
        modernTargets: ['chrome 83'],
        modernPolyfills: true,
      }),
    ],
    resolve: {
      alias: {
        '~/': '/src/',
      },
    },
  }
})
