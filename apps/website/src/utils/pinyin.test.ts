import { describe, expect, it } from 'vite-plus/test'
import { contactInitial, sortContactsByInitial } from './pinyin'

describe('contactInitial', () => {
  it('files pinyin, Latin, digits and empty names under their rail', () => {
    expect(contactInitial('相约星期六')).toBe('X')
    expect(contactInitial('阿宝')).toBe('A')
    expect(contactInitial('Ann')).toBe('A')
    expect(contactInitial('wl301010386256')).toBe('W')
    expect(contactInitial('95鸿蒙手机')).toBe('#')
    expect(contactInitial('')).toBe('#')
  })
})

describe('sortContactsByInitial', () => {
  it('orders digits, then initials, then same-initial names by pinyin', () => {
    const names = ['相约星期六', 'wl301010386256', '宝', '95鸿蒙手机', 'Ann', '白']

    const sorted = sortContactsByInitial(names, (name) => name)

    expect(sorted.map((entry) => entry.item)).toEqual([
      '95鸿蒙手机',
      'Ann',
      '白',
      '宝',
      'wl301010386256',
      '相约星期六',
    ])
    expect(sorted.map((entry) => entry.initial)).toEqual(['#', 'A', 'B', 'B', 'W', 'X'])
  })
})
