export type Ratio = { id: string; label: string; w: number; h: number }

// Standard Etsy print ratios (aspect only; Phase 1 is pixel-domain).
export const RATIOS: Ratio[] = [
  { id: '2x3', label: '2:3', w: 2, h: 3 },
  { id: '3x4', label: '3:4', w: 3, h: 4 },
  { id: '4x5', label: '4:5', w: 4, h: 5 },
  { id: '5x7', label: '5:7', w: 5, h: 7 },
  { id: '11x14', label: '11:14', w: 11, h: 14 },
  { id: 'iso', label: 'A (ISO)', w: 1000, h: 1414 },
]
