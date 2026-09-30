import { describe, expect, it } from 'vite-plus/test'
import { historyDepth, historyPosition } from './usePageBack'

describe('historyPosition', () => {
  it('reads the entry number vue-router wrote', () => {
    expect(historyPosition({ back: '/devices', position: 2 })).toBe(2)
  })

  it('reads nothing from a host entry or a malformed state', () => {
    expect(historyPosition(null)).toBe(0)
    expect(historyPosition(undefined)).toBe(0)
    expect(historyPosition({ back: '/devices', position: '2' })).toBe(0)
  })
})

describe('historyDepth', () => {
  it('counts the pages this document pushed', () => {
    expect(historyDepth({ back: '/devices', position: 3 }, 0)).toBe(3)
  })

  it('ignores the entries the WebView host loaded first', () => {
    expect(historyDepth({ back: '/devices', position: 4 }, 2)).toBe(2)
  })

  it('reads no depth on a document that has not pushed yet', () => {
    expect(historyDepth({ back: null, position: 2 }, 2)).toBe(0)
  })

  it('reads no depth from a malformed state', () => {
    expect(historyDepth({ back: 7, position: 3 }, 0)).toBe(0)
    expect(historyDepth('nope', 0)).toBe(0)
  })
})
