import { fileURLToPath } from 'node:url'
import { defineCollection, defineContentConfig } from '@nuxt/content'

// The markdown files under the repository root `docs/` folder are the single
// source of truth; they are never copied into this app.
const docsDir = fileURLToPath(new URL('../../docs', import.meta.url))

export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: {
        cwd: docsDir,
        include: '**/*.md',
      },
    }),
  },
})
