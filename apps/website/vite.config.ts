import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import unocss from 'unocss/vite'
import VueRouter from 'vue-router/vite'

export default defineConfig({
  plugins: [VueRouter({ dts: 'src/route-map.d.ts' }), vue(), unocss()],
  resolve: {
    alias: {
      '~/': '/src/',
    },
  },
})
