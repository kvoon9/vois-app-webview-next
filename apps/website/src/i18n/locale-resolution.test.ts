import { describe, expect, it } from 'vite-plus/test'
import { matchLocale, resolveLocale } from './locale-resolution'

describe('locale resolution', () => {
  it('prefers native, then the URL, then the stored choice, then the browser', () => {
    expect(
      resolveLocale({
        native: 'zh-CN',
        query: 'zh-TW',
        stored: 'en',
        browser: 'en-US',
      }),
    ).toBe('zh-CN')

    expect(
      resolveLocale({
        native: 'fr-FR',
        query: 'zh-TW',
        stored: 'en',
        browser: 'en-US',
      }),
    ).toBe('zh-TW')

    expect(
      resolveLocale({
        native: null,
        query: null,
        stored: 'en',
        browser: 'zh-TW',
      }),
    ).toBe('en')

    expect(
      resolveLocale({
        native: null,
        query: null,
        stored: null,
        browser: 'zh-Hant-HK',
      }),
    ).toBe('zh-TW')

    expect(resolveLocale({ native: null, query: null, stored: null, browser: null })).toBe('en')
  })

  it('maps regional tags onto the bundled catalogs', () => {
    expect(matchLocale('zh-HK')).toBe('zh-TW')
    expect(matchLocale('zh-SG')).toBe('zh-CN')
    expect(matchLocale('en-GB')).toBe('en')
    expect(matchLocale('fr-FR')).toBeNull()
    expect(matchLocale(undefined)).toBeNull()
  })
})
