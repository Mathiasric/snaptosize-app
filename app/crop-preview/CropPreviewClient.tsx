'use client'

import { useCallback, useState } from 'react'
import { RATIOS } from './lib/ratios'
import { boxFor, cropToCanvas, type Focal } from './lib/crop'
import { detectFocal } from './lib/autoFocal'
import CropCanvas from './components/CropCanvas'
import RatioStrip from './components/RatioStrip'

export default function CropPreviewClient() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [focal, setFocal] = useState<Focal>({ x: 0.5, y: 0.5 })
  const [ratioId, setRatioId] = useState<string>(RATIOS[0].id)
  const [error, setError] = useState<string | null>(null)
  const ratio = RATIOS.find((r) => r.id === ratioId)!

  const loadFile = useCallback((file: File) => {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    const img = new Image()
    img.onload = async () => {
      setImage(img)
      setFocal(await detectFocal(img))
    }
    img.onerror = () => setError('Could not load that image.')
    img.src = URL.createObjectURL(file)
  }, [])

  function handleDownload() {
    if (!image) return
    const box = boxFor(ratio.w, ratio.h, focal, image.naturalWidth, image.naturalHeight)
    const canvas = cropToCanvas(image, box)
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crop-${ratio.id}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-white">
      <h1 className="text-2xl font-semibold">Smart Crop Preview</h1>
      <p className="mt-1 text-sm text-white/60">
        Internal preview — auto focal-point crop for every Etsy ratio. Click the image to set the focal point.
      </p>

      {!image && (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) loadFile(f)
          }}
          className="mt-8 flex h-56 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-white/20 text-white/60 hover:border-[#2DD4BF]/60"
        >
          Drop an image or click to upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
          />
        </label>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {image && (
        <div className="mt-8 space-y-6">
          <CropCanvas image={image} ratio={ratio} focal={focal} onFocalChange={setFocal} />
          <RatioStrip
            image={image}
            focal={focal}
            ratios={RATIOS}
            selectedId={ratioId}
            onSelect={setRatioId}
          />
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              className="rounded-lg bg-[#2DD4BF] px-4 py-2 font-medium text-black hover:opacity-90"
            >
              Download {ratio.label} crop
            </button>
            <button
              onClick={() => setImage(null)}
              className="rounded-lg border border-white/20 px-4 py-2 text-white/80 hover:border-white/40"
            >
              New image
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
