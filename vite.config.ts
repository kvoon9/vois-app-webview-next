import { createRequire } from 'node:module'
import { configDefaults, defineConfig } from 'vite-plus'

// Root tests mount SFCs, so reuse the website's Vue plugin rather than a second root dependency.
const websiteRequire = createRequire(new URL('./apps/website/package.json', import.meta.url))
const vue = websiteRequire('@vitejs/plugin-vue').default

export default defineConfig({
  plugins: [vue()],
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    // Gitignored agent worktrees are separate checkouts, not this project's tests.
    exclude: [...configDefaults.exclude, '**/.claude/worktrees/**'],
  },
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    semi: false,
    singleQuote: true,
    ignorePatterns: [
      '.agents/skills/**',
      '.claude/skills/**',
      'tools/oxlint/anti-slop/**',
      'apps/docs/**',
      'docs/**/*.md',
      'api-reference/**',
    ],
  },
  lint: {
    jsPlugins: [
      { name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' },
      { name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' },
      { name: 'slop', specifier: 'eslint-plugin-slop' },
    ],
    settings: {
      slop: {
        inspection: { mode: 'recent-changes', tracebackCommits: 5 },
      },
    },
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      'slop/max-comment-length': 'error',
      'slop/no-chained-type-assertions': 'error',
      'slop/no-em-dash': 'error',
      'slop/no-jargon': 'error',
      'slop/no-static-only-class': 'error',
      'slop/no-trivial-functions': 'error',
      'slop/no-trivial-type-aliases': 'error',
      'slop/prefer-jsdoc': 'error',
      'anti-slop/no-chained-type-assertions': 'error',
      'anti-slop/no-conditional-empty-object-spread': 'error',
      'anti-slop/no-known-value-widening': 'error',
      'anti-slop/no-module-mocking': 'error',
      'anti-slop/no-object-parameters': 'error',
      'anti-slop/no-reflect-apply': 'error',
      'anti-slop/no-reflect-get': 'error',
      'anti-slop/no-runtime-typeof': 'error',
      'anti-slop/no-shape-in-symbol-names': 'error',
      'anti-slop/no-unknown-parameters': 'error',
      'anti-slop/no-unknown-returns': 'error',
      'anti-slop/no-unknown-type-aliases': 'error',
      'anti-slop/no-unsafe-dictionary-type': 'error',
      'anti-slop/no-widen-then-assert': 'error',
      'anti-slop/require-safety-comment-for-type-assertion': 'error',
    },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: [
      'apps/docs/**',
      '.agents/skills/**',
      '.claude/skills/**',
      'tools/oxlint/anti-slop/**',
    ],
  },
  run: {
    cache: true,
    tasks: {
      // 联网拉取最新文档，缓存会重放过期结果
      'docs:apipost': {
        command: 'node scripts/apipost-doc-to-markdown.mjs',
        cache: false,
      },
      // 同样联网，缓存会重放过期结果
      'docs:apipost:diff': {
        command: 'node scripts/apipost-doc-to-markdown.mjs --diff',
        cache: false,
      },
    },
  },
  resolve: {
    alias: {
      '~/': new URL('./apps/website/src/', import.meta.url).pathname,
    },
  },
})
