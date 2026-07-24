import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import legacy from '@vitejs/plugin-legacy'
import VueRouter from 'vue-router/vite'
import vueDevtools from 'vite-plugin-vue-devtools'
import { debugAuthPlugin } from './plugins/debug-auth.ts'
import { vconsoleDev } from './plugins/vconsole-dev.ts'

export default defineConfig(({ isPreview }) => {
  return {
    server: {
      host: true,
      port: 3021,
      proxy: {
        '/v2': {
          target: 'https://api.voischat.cn',
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: 5173,
      proxy: {
        '/v2': {
          target: 'https://api.voischat.cn',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      ...(isPreview ? [vconsoleDev()] : []),
      ...(!isPreview || process.argv.includes('--debug') ? [debugAuthPlugin()] : []),
      vueDevtools(),
      VueRouter({ dts: 'src/route-map.d.ts' }),
      vue(),
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
    build: {
      target: 'chrome83',
    },
  }
})
