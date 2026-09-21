import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { needsIntlPolyfill } from './intl-polyfill-needed'

const LOCALES = ['en', 'zh-CN', 'zh-TW']

/** Drop Intl members the way a trimmed low-end Intl build omits them. */
function withoutIntlMembers(...members: string[]) {
  const stub = Object.defineProperties({}, Object.getOwnPropertyDescriptors(Intl))
  for (const member of members) Reflect.deleteProperty(stub, member)
  vi.stubGlobal('Intl', stub)
}

/** Swap `Intl.DisplayNames` for a stand-in, leaving everything else real. */
function replaceDisplayNames(standIn: DisplayNamesStandIn) {
  const stub = Object.defineProperties({}, Object.getOwnPropertyDescriptors(Intl))
  Object.defineProperty(stub, 'DisplayNames', { value: standIn })
  vi.stubGlobal('Intl', stub)
}

type DisplayNamesStandIn = new (
  locales: string[],
  options?: { fallback?: string },
) => { of: (code: string) => string | undefined }

/** An engine that kept English data and trimmed the rest, as low-end ROMs do. */
class EnglishOnlyDisplayNames {
  private readonly locale: string

  constructor(locales: string[]) {
    this.locale = locales[0]
  }

  of(code: string): string {
    return this.locale === 'en' ? `name:${code}` : code
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('needsIntlPolyfill', () => {
  it('stays quiet on a healthy engine', () => {
    expect(needsIntlPolyfill(LOCALES)).toBe(false)
  })

  it('asks for the polyfill when Intl.DisplayNames is missing', () => {
    withoutIntlMembers('DisplayNames')

    expect(needsIntlPolyfill(LOCALES)).toBe(true)
  })

  it('asks for the polyfill when Intl.Locale is missing', () => {
    withoutIntlMembers('Locale')

    expect(needsIntlPolyfill(LOCALES)).toBe(true)
  })

  it('asks for the polyfill when DisplayNames echoes codes back', () => {
    replaceDisplayNames(
      class {
        of(code: string) {
          return code
        }
      },
    )

    expect(needsIntlPolyfill(LOCALES)).toBe(true)
  })

  it('checks every UI locale, not just the first', () => {
    replaceDisplayNames(EnglishOnlyDisplayNames)

    expect(needsIntlPolyfill(['en'])).toBe(false)
    expect(needsIntlPolyfill(LOCALES)).toBe(true)
  })

  it('asks for the polyfill when a lookup throws', () => {
    replaceDisplayNames(
      class {
        of(): string | undefined {
          throw new TypeError('no data')
        }
      },
    )

    expect(needsIntlPolyfill(LOCALES)).toBe(true)
  })
})
