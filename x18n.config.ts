import { defineConfig } from '@x18n/core'

/**
 * react-intl is auto-detected from the @formatjs/intl-* display-name packages,
 * but the app uses vue-i18n. Listing presets keeps detection to the real library.
 */
export default defineConfig({
  sourceLocale: 'zh-CN',
  presets: ['vue-i18n'],
  ignoreKeys: [
    // CategoryReportForm builds these from props.
    'feedback.*',
    'report.*',
    // Kept in commented-out template blocks in TranslationProfilePage.
    'profile.block',
    'profile.clearHistory',
    'profile.editRemarks',
    'profile.exitGroup',
    'profile.location',
    'profile.media',
    'profile.muteNotifications',
    'profile.readReceipts',
    'profile.stickOnTop',
    // The page-header language switch was dropped; the keys stay for a future picker.
    'language.*',
    // tm() returns this array, not a message.
    'reportTarget.reasons',
  ],
  resources: [
    {
      pattern: 'apps/website/src/i18n/locales/{locale}.{ext}',
    },
  ],
})
