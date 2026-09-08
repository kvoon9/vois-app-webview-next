import { defineConfig } from 'vite-plus'

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  fmt: {
    semi: false,
    singleQuote: true,
    ignorePatterns: ['.agents/skills/**', 'tools/oxlint/anti-slop/**'],
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
    ignorePatterns: ['.agents/skills/**', 'tools/oxlint/anti-slop/**'],
  },
  run: {
    cache: true,
  },
  resolve: {
    alias: {
      '~/': new URL('./apps/website/src/', import.meta.url).pathname,
    },
  },
})
