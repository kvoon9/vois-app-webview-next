import { defineConfig } from '@x18n/core'

/**
 * react-intl is auto-detected from the @formatjs/intl-* display-name packages,
 * but the app uses vue-i18n. Listing presets keeps detection to the real library.
 */
export default defineConfig({
  sourceLocale: 'zh-CN',
  presets: ['vue-i18n'],
  resources: [
    {
      pattern: 'apps/website/src/i18n/locales/{locale}.{ext}',
    },
  ],
})
