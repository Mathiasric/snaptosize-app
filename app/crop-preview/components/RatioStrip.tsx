'use client'

import { useEffect, useRef } from 'react'
import { boxFor, tightestDims, type Focal } from '../lib/crop'
import type { Ratio } from '../lib/ratios'

type Props = {
  image: HTMLImageElement
  focal: Focal
  ratios: Ratio[]
  selectedId: string
  onSelect: (id: string) => void
}

const THUMB = 56 // px longest edge of each thumbnail

function Thumb({ image, focal, ratio }: { image: HTMLImageElement; focal: Focal; ratio: Ratio }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dims = ratio.members?.length
      ? tightestDims(ratio.members, focal, image.naturalWidth, image.naturalHeight)
      : ratio
    const box = boxFor(dims.w, dims.h, focal, image.naturalWidth, image.naturalHeight)
    const scale = THUMB / Math.max(box.width, box.height)
    canvas.width = Math.round(box.width * scale)
    canvas.height = Math.round(box.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, box.x, box.y, box.width, box.height, 0, 0, canvas.width, canvas.height)
  }, [image, focal, ratio])
  return <canvas ref={ref} className="rounded-[3px]" />
}

export default function RatioStrip({ image, focal, ratios, selectedId, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
      {ratios.map((r) => {
        const selected = selectedId === r.id
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            aria-pressed={selected}
            className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
              selected
                ? 'border-accent bg-accent/[0.08] glow-purple'
                : 'border-border bg-background/30 hover:border-foreground/20 hover:bg-background/50'
            }`}
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center">
              <Thumb image={image} focal={focal} ratio={r} />
            </div>
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${selected ? 'text-foreground' : 'text-foreground/80'}`}>
                {r.label}
              </div>
              <div className={`text-xs ${selected ? 'text-accent-light' : 'text-foreground/40'}`}>
                {selected ? 'Selected' : 'Preview fit'}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
