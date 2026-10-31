import { describe, expect, it } from 'vite-plus/test'
import unoConfig from '../../uno.config'
import { toChipOption, toChipOptions } from './chip-options'

describe('toChipOption', () => {
  it('passes a plain string through byte-identical', () => {
    expect(toChipOption('连接').text).toBe('连接')
    expect(toChipOption('General').emoji).toBeUndefined()
    expect(toChipOption('General').icon).toBeUndefined()
  })

  it('extracts text with an optional emoji or icon', () => {
    expect(toChipOption({ text: '通用', emoji: '💬' })).toEqual({ text: '通用', emoji: '💬' })
    expect(toChipOption({ text: '账户', icon: 'i-ph-user-circle' })).toEqual({
      text: '账户',
      icon: 'i-ph-user-circle',
    })
  })

  it('degrades wrong-typed fields to text-only', () => {
    // The boundary contract is `string | ChipOption`, but `tm()` answers come
    // from locale data a maintainer may mistype, so malformed entries are cast
    // in on purpose: the schema must degrade them, not throw.
    const malformed: unknown[] = [
      { text: '通用', emoji: 42 },
      { text: '通用', icon: true },
      7,
      null,
      { emoji: '💬' },
    ]
    // SAFETY: the test feeds malformed values on purpose; the cast only restores
    // the declared parameter type, the schema handles the rest.
    const decoded = (malformed as Parameters<typeof toChipOption>[0][]).map(toChipOption)
    expect(decoded[0]).toEqual({ text: '通用' })
    expect(decoded[1]).toEqual({ text: '通用' })
    expect(decoded[2]).toEqual({ text: '7' })
    expect(decoded[3]).toEqual({ text: 'null' })
    expect(decoded[4]).toEqual({ text: '[object Object]' })
  })
})

describe('toChipOptions', () => {
  it('maps a mixed string and object list in order', () => {
    expect(toChipOptions(['连接', { text: '账户', icon: 'i-ph-user-circle' }])).toEqual([
      { text: '连接' },
      { text: '账户', icon: 'i-ph-user-circle' },
    ])
  })

  it('yields no chips for undefined or an index-keyed object form', () => {
    expect(toChipOptions(undefined)).toEqual([])
    expect(toChipOptions({ 0: '通用', 1: { text: '聊天', emoji: '🗨️' } })).toEqual([
      { text: '通用' },
      { text: '聊天', emoji: '🗨️' },
    ])
  })

  it('safelists every icon class the chip renderer can bind', () => {
    // Icon classes reach the DOM through a runtime `:class` binding the
    // extractor misses; a class absent from the safelist renders an empty box.
    const { safelist } = unoConfig
    expect(safelist).toContain('i-ph-user-circle')
  })
})
