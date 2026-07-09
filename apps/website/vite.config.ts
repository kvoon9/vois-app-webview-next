import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import legacy from '@vitejs/plugin-legacy'
import VueRouter from 'vue-router/vite'

function vconsoleDev(): import('vite-plus').Plugin {
  const require = createRequire(import.meta.url)
  const vconsolePath = require.resolve('vconsole/dist/vconsole.min.js')
  const vconsoleSource = `${readFileSync(vconsolePath, 'utf-8')}\nnew VConsole()`
  const resolvedId = '/@vconsole-dev'

  return {
    name: 'vconsole-dev',
    apply: 'serve',
    resolveId(id) {
      if (id === resolvedId) return resolvedId
    },
    load(id) {
      if (id === resolvedId) return vconsoleSource
    },
    transformIndexHtml(html) {
      return html.replace(
        '<div id="app">',
        `<script src="${resolvedId}"></script>\n    <div id="app">`,
      )
    },
  }
}

export default defineConfig({
  server: {
    host: true,
    port: 3021,
  },
  preview: {
    host: true,
    port: 5173,
  },
  plugins: [
    vconsoleDev(),
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
})
