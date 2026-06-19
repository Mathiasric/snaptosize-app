// Perfect Fit v1 ratios. `group` maps to the Runner PACK_SIZES key that drives
// which exact print sizes the focal-cropped pack contains.
export type PFRatio = {
  id: string
  label: string
  w: number
  h: number
  group: string
  count: number
  // For multi-aspect packs (Common sizes): the member aspects. When present, the live
  // preview shows the TIGHTEST crop among them so the seller can confirm the subject
  // survives every size before exporting. Single-ratio packs leave this undefined.
  members?: { w: number; h: number }[]
}

// `count` = how many print sizes are in that pack (mirrors the Runner's PACK_SIZES).
export const PF_RATIOS: PFRatio[] = [
  { id: '2x3', label: '2:3', w: 2, h: 3, group: '2x3', count: 7 },
  { id: '3x4', label: '3:4', w: 3, h: 4, group: '3x4', count: 5 },
  { id: '4x5', label: '4:5', w: 4, h: 5, group: '4x5', count: 5 },
  { id: 'iso', label: 'A / ISO', w: 1000, h: 1414, group: 'ISO', count: 5 },
  // Common sizes — the popular mixed-aspect odd sizes (mirrors the Runner's EXTRAS
  // pack), each focal-cropped from the single focal point. One zip, one Etsy slot.
  {
    id: 'common',
    label: 'Common sizes',
    w: 11,
    h: 14,
    group: 'EXTRAS',
    count: 6,
    members: [
      { w: 5, h: 7 },
      { w: 8.5, h: 11 },
      { w: 11, h: 14 },
      { w: 11, h: 17 },
      { w: 13, h: 19 },
      { w: 20, h: 24 },
    ],
  },
]
