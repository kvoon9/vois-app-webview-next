import { describe, expect, it } from 'vite-plus/test'
import { parseRouteParamId } from './useRouteParamId'

describe('parseRouteParamId', () => {
  it('accepts a positive safe integer and keeps the first of repeated values', () => {
    expect(parseRouteParamId('441')).toBe(441)
    expect(parseRouteParamId(' 12 ')).toBe(12)
    expect(parseRouteParamId(['441', '442'])).toBe(441)
  })

  it('rejects missing or blank values', () => {
    expect(parseRouteParamId(undefined)).toBeNull()
    expect(parseRouteParamId('')).toBeNull()
    expect(parseRouteParamId('   ')).toBeNull()
    expect(parseRouteParamId([])).toBeNull()
  })

  it('rejects zero, negatives, fractions, and non-numbers', () => {
    expect(parseRouteParamId('0')).toBeNull()
    expect(parseRouteParamId('-3')).toBeNull()
    expect(parseRouteParamId('1.5')).toBeNull()
    expect(parseRouteParamId('abc')).toBeNull()
    expect(parseRouteParamId('Infinity')).toBeNull()
  })
})
