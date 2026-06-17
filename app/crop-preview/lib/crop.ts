export type Box = { x: number; y: number; width: number; height: number }
export type Focal = { x: number; y: number } // normalized 0..1

// Largest box of aspect w:h that fits inside srcW x srcH,
// centered on the (normalized) focal point and clamped to image bounds.
export function boxFor(w: number, h: number, focal: Focal, srcW: number, srcH: number): Box {
  const targetAspect = w / h
  const srcAspect = srcW / srcH
  let width: number
  let height: number
  if (srcAspect > targetAspect) {
    height = srcH
    width = Math.round(height * targetAspect)
  } else {
    width = srcW
    height = Math.round(width / targetAspect)
  }
  const cx = focal.x * srcW
  const cy = focal.y * srcH
  let x = Math.round(cx - width / 2)
  let y = Math.round(cy - height / 2)
  x = Math.max(0, Math.min(x, srcW - width))
  y = Math.max(0, Math.min(y, srcH - height))
  return { x, y, width, height }
}

// Browser-only: crop `image` to `box` and return a canvas at source resolution.
export function cropToCanvas(image: CanvasImageSource, box: Box): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = box.width
  canvas.height = box.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height)
  return canvas
}
