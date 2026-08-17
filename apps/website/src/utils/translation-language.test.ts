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
    expect(options[0]).toMatchObject({ name: 'American English', nativeName: 'American English' })
    expect(options[1]).toMatchObject({ name: 'British English', nativeName: 'British English' })
  })

  it('searches display names and locale codes', () => {
    expect(filterTranslationLanguageOptions(options, 'English')).toEqual([options[0], options[1]])
    expect(filterTranslationLanguageOptions(options, 'zh-cn')).toEqual([options[2]])
  })

  it('normalizes language subtags used by translation modes', () => {
    expect(['en', 'EN-us', 'zh-Hans'].map(translationLanguageSubtag)).toEqual(['en', 'en', 'zh'])
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
