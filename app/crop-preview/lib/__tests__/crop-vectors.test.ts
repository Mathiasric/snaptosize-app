import { describe, it, expect } from 'vitest'
import { boxFor } from '../crop'
import vectors from './crop-vectors.json'

describe('boxFor matches shared crop-vectors', () => {
  for (const c of vectors.cases) {
    it(c.name, () => {
      const box = boxFor(c.w, c.h, c.focal, c.srcW, c.srcH)
      expect(box).toEqual(c.expected)
    })
  }
})
