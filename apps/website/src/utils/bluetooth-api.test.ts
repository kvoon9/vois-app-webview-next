import { describe, expect, it } from 'vite-plus/test'
import { parseValidityPeriod } from './bluetooth-api'

describe('parseValidityPeriod', () => {
  it('splits the backend duration into a count and a unit', () => {
    expect(parseValidityPeriod('12month')).toEqual({ count: 12, unit: 'month' })
    expect(parseValidityPeriod('1year')).toEqual({ count: 1, unit: 'year' })
  })

  it('returns null for anything that is not `<count><unit>`', () => {
    expect(parseValidityPeriod('12 months')).toBeNull()
    expect(parseValidityPeriod('forever')).toBeNull()
    expect(parseValidityPeriod('')).toBeNull()
  })
})
