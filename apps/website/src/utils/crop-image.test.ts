import { describe, expect, it } from 'vite-plus/test'
import {
  clampCrop,
  coverScale,
  cropSourceRect,
  type CropSource,
  type CropState,
} from './crop-image'

const FRAME = 320

/** Wide, tall, square and extreme panoramas: the aspect ratios a group avatar sees. */
const SOURCES: CropSource[] = [
  { width: 4000, height: 3000 },
  { width: 3000, height: 4000 },
  { width: 512, height: 512 },
  { width: 6000, height: 400 },
]

const STATES: CropState[] = [
  { scale: 1, tx: 0, ty: 0 },
  { scale: 1.5, tx: 40, ty: -25 },
  // Deliberately far outside the bounds, the way an unclamped gesture arrives
  { scale: 1, tx: 1e6, ty: -1e6 },
  { scale: 8, tx: -1e6, ty: 1e6 },
]

describe('coverScale', () => {
  it('takes the tighter axis, so the source covers the whole frame', () => {
    expect(coverScale({ width: 4000, height: 3000 }, FRAME)).toBeCloseTo(FRAME / 3000)
    expect(coverScale({ width: 300, height: 400 }, FRAME)).toBeCloseTo(FRAME / 300)
  })
})

describe('clampCrop', () => {
  const source = SOURCES[0]

  it('slides the source only as far as its own overflow', () => {
    const drawn = coverScale(source, FRAME)
    expect(clampCrop({ scale: 1, tx: 1e6, ty: -1e6 }, source, FRAME)).toEqual({
      scale: 1,
      tx: (source.width * drawn - FRAME) / 2,
      ty: -(source.height * drawn - FRAME) / 2,
    })
  })

  it('leaves a state that already fits untouched', () => {
    const state = { scale: 2, tx: 30, ty: -10 }
    expect(clampCrop(state, source, FRAME)).toEqual(state)
  })
})

describe('cropSourceRect', () => {
  it('centres on the source when nothing is dragged', () => {
    const rect = cropSourceRect({ scale: 1, tx: 0, ty: 0 }, { width: 4000, height: 3000 }, FRAME)
    expect(rect.size).toBeCloseTo(3000)
    expect(rect.x).toBeCloseTo(500)
    expect(rect.y).toBeCloseTo(0)
  })

  it('halves the window when the zoom doubles', () => {
    const rect = cropSourceRect({ scale: 2, tx: 0, ty: 0 }, { width: 4000, height: 3000 }, FRAME)
    expect(rect.size).toBeCloseTo(1500)
  })

  it('never asks for pixels outside the image', () => {
    for (const source of SOURCES) {
      const shortest = Math.min(source.width, source.height)
      for (const state of STATES) {
        const rect = cropSourceRect(state, source, FRAME)
        const label = `${source.width}x${source.height} scale ${state.scale}`
        expect(rect.size, label).toBeLessThanOrEqual(shortest)
        expect(rect.x, label).toBeGreaterThanOrEqual(0)
        expect(rect.y, label).toBeGreaterThanOrEqual(0)
        expect(rect.x + rect.size, label).toBeLessThanOrEqual(source.width)
        expect(rect.y + rect.size, label).toBeLessThanOrEqual(source.height)
      }
    }
  })
})
