// Perfect Fit v1 ratios. `group` maps to the Runner PACK_SIZES key that drives
// which exact print sizes the focal-cropped pack contains.
export type PFRatio = { id: string; label: string; w: number; h: number; group: string }

export const PF_RATIOS: PFRatio[] = [
  { id: '2x3', label: '2:3', w: 2, h: 3, group: '2x3' },
  { id: '3x4', label: '3:4', w: 3, h: 4, group: '3x4' },
  { id: '4x5', label: '4:5', w: 4, h: 5, group: '4x5' },
  { id: 'iso', label: 'A / ISO', w: 1000, h: 1414, group: 'ISO' },
]
