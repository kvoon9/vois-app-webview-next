import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The markdown files under the repository root `docs/` folder are the single
// source of truth. Read their names here so every document route is prerendered
// for `nuxt generate`.
const docsDir = fileURLToPath(new URL('../../docs', import.meta.url))
const docRoutes = readdirSync(docsDir)
  .filter((name) => name.endsWith('.md'))
  .map((name) => `/${name.replace(/\.md$/, '')}`)

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/content'],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2026-10-13',
  devtools: { enabled: false },
  ui: {
    colors: {
      primary: 'green',
      neutral: 'zinc',
    },
  },
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', ...docRoutes],
    },
  },
})
