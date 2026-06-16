'use client'

import { useEffect, useRef } from 'react'
import { boxFor, type Focal } from '../lib/crop'
import type { Ratio as RatioDef } from '../lib/ratios'

type Props = {
  image: HTMLImageElement
  ratio: RatioDef
  focal: Focal
  onFocalChange: (f: Focal) => void
}

const MAX_DISPLAY = 560 // px, longest display edge

export default function CropCanvas({ image, ratio, focal, onFocalChange }: Props) {
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

    // dim outside the crop box
    const box = boxFor(ratio.w, ratio.h, focal, srcW, srcH)
    const bx = box.x * scale
    const by = box.y * scale
    const bw = box.width * scale
    const bh = box.height * scale
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, dispW, by)
    ctx.fillRect(0, by + bh, dispW, dispH - (by + bh))
    ctx.fillRect(0, by, bx, bh)
    ctx.fillRect(bx + bw, by, dispW - (bx + bw), bh)

    // crop border (teal — conversion color)
    ctx.strokeStyle = '#2DD4BF'
    ctx.lineWidth = 2
    ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2)

    // focal marker
    ctx.fillStyle = '#2DD4BF'
    ctx.beginPath()
    ctx.arc(focal.x * dispW, focal.y * dispH, 5, 0, Math.PI * 2)
    ctx.fill()
  }, [image, ratio, focal])

  function setFocalFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    onFocalChange({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) })
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setFocalFromEvent(e)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.buttons !== 1) return // only while primary button/touch held
    setFocalFromEvent(e)
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      className="cursor-crosshair touch-none rounded-lg border border-white/10"
    />
  )
}
