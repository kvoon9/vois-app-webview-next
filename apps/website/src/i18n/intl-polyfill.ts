/**
 * formatjs shims for engines whose Intl build is missing CLDR data or whole
 * constructors. Loaded by `main.ts` only when `./intl-polyfill-needed` says the
 * engine can't be trusted, so healthy devices never download this chunk.
 *
 * Order matters: `polyfill.js` installs `Intl.DisplayNames` first, and each
 * locale-data file only does something when that polyfilled constructor exists
 * (`__addLocaleData`), so importing data first silently drops it.
 *
 * `@formatjs/intl-getcanonicallocales` is deliberately absent: the build targets
 * Chrome 83, and `Intl.getCanonicalLocales` has been native since Chrome 54.
 */
import '@formatjs/intl-locale/polyfill.js'
import '@formatjs/intl-displaynames/polyfill.js'
import '@formatjs/intl-displaynames/locale-data/en.js'
import '@formatjs/intl-displaynames/locale-data/zh.js'
import '@formatjs/intl-displaynames/locale-data/zh-Hant.js'
