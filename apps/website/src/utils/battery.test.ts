import { describe, expect, it } from 'vite-plus/test'
import { batteryIcon } from './battery'

describe('batteryIcon', () => {
  it('hides an expired reading instead of showing 0%', () => {
    expect(batteryIcon(0)).toBeNull()
  })

  it('picks the icon bucket for each level', () => {
    expect(batteryIcon(5)).toBe('i-ph-battery-warning-fill')
    expect(batteryIcon(20)).toBe('i-ph-battery-low-fill')
    expect(batteryIcon(40)).toBe('i-ph-battery-medium-fill')
    expect(batteryIcon(60)).toBe('i-ph-battery-high-fill')
    expect(batteryIcon(80)).toBe('i-ph-battery-full-fill')
    expect(batteryIcon(100)).toBe('i-ph-battery-full-fill')
  })
})
