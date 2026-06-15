import { describe, it, expect } from 'vitest'
import { focalFromCrop } from '../autoFocal'

describe('focalFromCrop', () => {
  it('maps a crop rect to the normalized center of the rect', () => {
    const focal = focalFromCrop({ x: 100, y: 50, width: 200, height: 100 }, 400, 400)
    expect(focal).toEqual({ x: 0.5, y: 0.25 }) // center (200,100) / (400,400)
  })

  it('returns center for a full-image crop', () => {
    const focal = focalFromCrop({ x: 0, y: 0, width: 800, height: 600 }, 800, 600)
    expect(focal).toEqual({ x: 0.5, y: 0.5 })
  })
})
