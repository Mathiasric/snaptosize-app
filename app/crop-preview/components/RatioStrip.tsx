'use client'

import { useEffect, useRef } from 'react'
import { boxFor, type Focal } from '../lib/crop'
import type { Ratio } from '../lib/ratios'

type Props = {
  image: HTMLImageElement
  focal: Focal
  ratios: Ratio[]
  selectedId: string
  onSelect: (id: string) => void
}

const THUMB = 88 // px longest edge of each thumbnail

function Thumb({ image, focal, ratio }: { image: HTMLImageElement; focal: Focal; ratio: Ratio }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const box = boxFor(ratio.w, ratio.h, focal, image.naturalWidth, image.naturalHeight)
    const scale = THUMB / Math.max(box.width, box.height)
    canvas.width = Math.round(box.width * scale)
    canvas.height = Math.round(box.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, box.x, box.y, box.width, box.height, 0, 0, canvas.width, canvas.height)
  }, [image, focal, ratio])
  return <canvas ref={ref} className="rounded" />
}

export default function RatioStrip({ image, focal, ratios, selectedId, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      {ratios.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id)}
          className={`flex flex-col items-center gap-1 rounded-lg p-2 transition ${
            selectedId === r.id ? 'ring-2 ring-[#2DD4BF]' : 'ring-1 ring-white/10 hover:ring-white/30'
          }`}
        >
          <Thumb image={image} focal={focal} ratio={r} />
          <span className="text-xs text-white/80">{r.label}</span>
        </button>
      ))}
    </div>
  )
}
