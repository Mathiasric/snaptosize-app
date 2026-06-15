import { describe, it, expect } from 'vitest'
import { boxFor } from '../crop'

describe('boxFor', () => {
  it('returns a 2:3 box of full height on a square source, centered', () => {
    const box = boxFor(2, 3, { x: 0.5, y: 0.5 }, 300, 300)
    expect(box).toEqual({ x: 50, y: 0, width: 200, height: 300 })
  })

  it('clamps the box to the left edge when focal is at x=0', () => {
    const box = boxFor(2, 3, { x: 0, y: 0.5 }, 300, 300)
    expect(box.x).toBe(0)
    expect(box.width).toBe(200)
  })

  it('clamps the box to the right edge when focal is at x=1', () => {
    const box = boxFor(2, 3, { x: 1, y: 0.5 }, 300, 300)
    expect(box.x).toBe(100) // srcW(300) - width(200)
  })

  it('uses full width and crops height on a wide source for a 4:5 box', () => {
    const box = boxFor(4, 5, { x: 0.5, y: 0.5 }, 1000, 500)
    // target aspect 0.8; source aspect 2.0 (wider) -> full height 500, width 400
    expect(box).toEqual({ x: 300, y: 0, width: 400, height: 500 })
  })
})
