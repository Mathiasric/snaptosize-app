import type { Focal } from './crop'

type CropRect = { x: number; y: number; width: number; height: number }

// Pure: normalized center of a crop rect.
export function focalFromCrop(crop: CropRect, srcW: number, srcH: number): Focal {
  return { x: (crop.x + crop.width / 2) / srcW, y: (crop.y + crop.height / 2) / srcH }
}

// Browser-only: run smartcrop to find the subject; fall back to center on any failure.
export async function detectFocal(image: HTMLImageElement): Promise<Focal> {
  try {
    const mod = await import('smartcrop')
    const smartcrop = (mod as any).default ?? mod
    const result = await smartcrop.crop(image, { width: 100, height: 100 })
    return focalFromCrop(result.topCrop, image.naturalWidth, image.naturalHeight)
  } catch {
    return { x: 0.5, y: 0.5 }
  }
}
