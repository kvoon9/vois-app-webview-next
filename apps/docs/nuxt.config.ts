import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// The markdown files under the repository root `docs/` folder are the single
// source of truth. Walk it recursively (subtrees like docs/native/ keep their
// own layout) so every document route is prerendered for `nuxt generate`.
const docsDir = fileURLToPath(new URL('../../docs', import.meta.url))
const docRoutes: string[] = []
const walkDocs = (dir: string, prefix = ''): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      walkDocs(path.join(dir, entry.name), `${prefix}${entry.name}/`)
    } else if (entry.name === '.navigation.md') {
      // Directory navigation config, not a page.
    } else if (entry.name.endsWith('.md')) {
      // Content slugs the file segment to lowercase (README.md -> /readme).
      docRoutes.push(`/${prefix}${entry.name.replace(/\.md$/, '').toLowerCase()}`)
    }
  }
}
walkDocs(docsDir)

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
