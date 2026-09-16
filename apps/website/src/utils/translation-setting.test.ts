import { describe, expect, it } from 'vite-plus/test'
import {
  initialLanguagePair,
  nextSettingForSkill,
  pickLanguagePair,
  swapLanguagePair,
  ZH_EN_LANGUAGES,
} from './translation-setting'

const en = ['en-US', 'en-GB', 'ja-JP']

describe('nextSettingForSkill', () => {
  it('returns null when picking the active skill', () => {
    expect(nextSettingForSkill({ skill: 0, source: '', target: '' }, 0, en)).toBeNull()
  })

  it('clears the languages for the off skill', () => {
    expect(nextSettingForSkill({ skill: 2, source: 'zh-CN', target: 'en-US' }, 0, en)).toEqual({
      skill: 0,
      source: '',
      target: '',
    })
  })

  it('forces zh-CN <-> en-US for the basic skill', () => {
    expect(nextSettingForSkill({ skill: 3, source: 'ja-JP', target: 'en-GB' }, 1, en)).toEqual({
      skill: 1,
      source: 'zh-CN',
      target: 'en-US',
    })
  })

  it('uses en as source for the zh-en skill when the previous source was english', () => {
    expect(nextSettingForSkill({ skill: 3, source: 'en-US', target: 'ja-JP' }, 2, en)).toEqual({
      skill: 2,
      source: 'en-US',
      target: 'zh-CN',
    })
  })

  it('falls back to the first option when the previous source is unsupported', () => {
    expect(
      nextSettingForSkill({ skill: 2, source: 'zh-CN', target: 'en-US' }, 3, ['fr-FR', 'de-DE']),
    ).toEqual({ skill: 3, source: 'fr-FR', target: 'de-DE' })
  })

  it('returns null when no second language is available for the multi skill', () => {
    expect(
      nextSettingForSkill({ skill: 2, source: 'zh-CN', target: 'en-US' }, 3, ['fr-FR']),
    ).toBeNull()
  })
})

describe('pickLanguagePair', () => {
  it('keeps the current target when picking a different source', () => {
    expect(
      pickLanguagePair({ skill: 3, source: 'en-US', target: 'ja-JP' }, 'source', 'de-DE'),
    ).toEqual({ skill: 3, source: 'de-DE', target: 'ja-JP' })
  })

  it('swaps the pair when the new source equals the current target', () => {
    expect(
      pickLanguagePair({ skill: 3, source: 'en-US', target: 'ja-JP' }, 'source', 'ja-JP'),
    ).toEqual({ skill: 3, source: 'ja-JP', target: 'en-US' })
  })

  it('swaps the pair when the new target equals the current source', () => {
    expect(
      pickLanguagePair({ skill: 3, source: 'en-US', target: 'ja-JP' }, 'target', 'en-US'),
    ).toEqual({ skill: 3, source: 'ja-JP', target: 'en-US' })
  })
})

describe('swapLanguagePair', () => {
  it('flips source and target without touching skill', () => {
    expect(swapLanguagePair({ skill: 2, source: 'zh-CN', target: 'en-US' })).toEqual({
      skill: 2,
      source: 'en-US',
      target: 'zh-CN',
    })
  })
})

describe('ZH_EN_LANGUAGES', () => {
  it('exposes the two fixed zh-en languages', () => {
    expect(ZH_EN_LANGUAGES).toEqual(['zh-CN', 'en-US'])
  })
})

describe('initialLanguagePair', () => {
  it('keeps the stored pair when both languages are set', () => {
    expect(initialLanguagePair({ skill: 3, source: 'ja-JP', target: 'de-DE' })).toEqual({
      skill: 3,
      source: 'ja-JP',
      target: 'de-DE',
    })
  })

  it('keeps the off skill so a reopened page does not claim translation is on', () => {
    expect(initialLanguagePair({ skill: 0, source: '', target: '' })).toEqual({
      skill: 0,
      source: 'zh-CN',
      target: 'en-US',
    })
  })

  it('normalizes a stored non-multi skill to the multi skill this page saves', () => {
    expect(initialLanguagePair({ skill: 2, source: 'zh-CN', target: 'en-US' })).toEqual({
      skill: 3,
      source: 'zh-CN',
      target: 'en-US',
    })
  })

  it('breaks a duplicate pair apart instead of leaving it equal', () => {
    expect(initialLanguagePair({ skill: 3, source: 'ja-JP', target: 'ja-JP' })).toEqual({
      skill: 3,
      source: 'ja-JP',
      target: 'zh-CN',
    })
    expect(initialLanguagePair({ skill: 3, source: 'zh-CN', target: 'zh-CN' })).toEqual({
      skill: 3,
      source: 'zh-CN',
      target: 'en-US',
    })
  })
})
