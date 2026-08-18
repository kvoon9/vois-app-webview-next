import { describe, expect, it } from 'vite-plus/test'
import {
  createTranslationLanguageOptions,
  filterTranslationLanguageOptions,
  translationLanguageSubtag,
} from './translation-language'

describe('translation language options', () => {
  const options = createTranslationLanguageOptions(['', 'en-US', 'en-GB', 'zh-CN', 'en-US'], 'en')

  it('deduplicates codes and keeps locale variants visible', () => {
    expect(options.map(({ code, flag }) => ({ code, flag }))).toEqual([
      { code: 'en-US', flag: '🇺🇸' },
      { code: 'en-GB', flag: '🇬🇧' },
      { code: 'zh-CN', flag: '🇨🇳' },
    ])
    expect(options[0]).toMatchObject({
      name: 'English (United States)',
      nativeName: 'English (United States)',
    })
    expect(options[1]).toMatchObject({
      name: 'English (United Kingdom)',
      nativeName: 'English (United Kingdom)',
    })
    expect(options[2]).toMatchObject({
      name: 'Chinese (Simplified)',
      nativeName: '中文(简体)',
    })
  })

  it('uses a consistent language and variant format', () => {
    const localized = createTranslationLanguageOptions(
      ['en-US', 'en-GB', 'zh-CN', 'zh-TW', 'es-MX'],
      'zh-CN',
    )

    expect(localized.map(({ name }) => name)).toEqual([
      '英语(美国)',
      '英语(英国)',
      '中文(简体)',
      '中文(繁体)',
      '西班牙语(墨西哥)',
    ])
  })

  it('searches display names and locale codes', () => {
    expect(filterTranslationLanguageOptions(options, 'English')).toEqual([options[0], options[1]])
    expect(filterTranslationLanguageOptions(options, 'United States')).toEqual([options[0]])
    expect(filterTranslationLanguageOptions(options, 'zh-cn')).toEqual([options[2]])
  })

  it('normalizes language subtags used by translation modes', () => {
    expect(['en', 'EN-us', 'zh-Hans', 'en-US!', 'en_US!'].map(translationLanguageSubtag)).toEqual([
      'en',
      'en',
      'zh',
      'en',
      'en',
    ])
  })

  it('falls back safely for invalid locale codes', () => {
    expect(createTranslationLanguageOptions(['invalid_locale'], 'en')).toEqual([
      {
        code: 'invalid_locale',
        flag: '🌐',
        name: 'invalid_locale',
        nativeName: 'invalid_locale',
      },
    ])
  })
})
