'use client'

import { useEffect, useRef, useState } from 'react'
import { Move } from 'lucide-react'
import { boxFor, type Focal } from '../lib/crop'
import type { Ratio as RatioDef } from '../lib/ratios'

type Props = {
  image: HTMLImageElement
  ratio: RatioDef
  focal: Focal
  onFocalChange: (f: Focal) => void
  landscape?: boolean
}

const MAX_DISPLAY = 560 // px, longest display edge

export default function CropCanvas({ image, ratio, focal, onFocalChange, landscape }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const srcW = image.naturalWidth
    const srcH = image.naturalHeight
    const scale = Math.min(1, MAX_DISPLAY / Math.max(srcW, srcH))
    const dispW = Math.round(srcW * scale)
    const dispH = Math.round(srcH * scale)
    canvas.width = dispW
    canvas.height = dispH

    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, dispW, dispH)
    ctx.drawImage(image, 0, 0, dispW, dispH)

    // dim outside the crop box. Multi-aspect packs (Common sizes) preview their
    // representative aspect (11x14). Landscape swaps the aspect (3:2 vs 2:3).
    const aw = landscape ? ratio.h : ratio.w
    const ah = landscape ? ratio.w : ratio.h
    const box = boxFor(aw, ah, focal, srcW, srcH)
    const bx = box.x * scale
    const by = box.y * scale
    const bw = box.width * scale
    const bh = box.height * scale
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, dispW, by)
    ctx.fillRect(0, by + bh, dispW, dispH - (by + bh))
    ctx.fillRect(0, by, bx, bh)
    ctx.fillRect(bx + bw, by, dispW - (bx + bw), bh)

    // Crop outline: neutral white with a soft dark halo so it stays legible over
    // any artwork. Not a brand color — the rail's purple owns UI selection.
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'
    ctx.lineWidth = 2
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 3
    ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2)
    ctx.shadowBlur = 0
  }, [image, ratio, focal, landscape])

  // Relative drag: grab anywhere and slide the crop to frame the subject —
  // smoother + more precise than jump-to-click. Aspect-agnostic.
  const dragRef = useRef<{ px: number; py: number; fx: number; fy: number } | null>(null)
  // Discoverability cue — hide it once the user has dragged at least once.
  const [hinted, setHinted] = useState(false)

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setHinted(true)
    dragRef.current = { px: e.clientX, py: e.clientY, fx: focal.x, fy: focal.y }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const start = dragRef.current
    if (!start || e.buttons !== 1) return // only while primary button/touch held
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dx = (e.clientX - start.px) / rect.width
    const dy = (e.clientY - start.py) / rect.height
    onFocalChange({
      x: Math.min(1, Math.max(0, start.fx + dx)),
      y: Math.min(1, Math.max(0, start.fy + dy)),
    })
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="h-auto max-h-[440px] w-auto max-w-full cursor-grab touch-none rounded-lg border border-white/10 active:cursor-grabbing"
      />
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
          hinted ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          <Move className="h-3.5 w-3.5" />
          Drag to reposition
        </span>
      </div>
    </div>
  )
}
