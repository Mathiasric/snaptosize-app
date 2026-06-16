'use client'

import { useCallback, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { PF_RATIOS, type PFRatio } from './lib/ratios'
import { type Focal } from '../crop-preview/lib/crop'
import { detectFocal } from '../crop-preview/lib/autoFocal'
import CropCanvas from '../crop-preview/components/CropCanvas'

type Phase = 'idle' | 'uploading' | 'queued' | 'running' | 'done' | 'error'

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  uploading: 'Uploading your image…',
  queued: 'Queued…',
  running: 'Cropping every print size…',
  done: 'Done — your download started.',
  error: '',
}

export default function PerfectFitClient() {
  const { user } = useUser()
  const isPro = (user?.publicMetadata as { plan?: string } | undefined)?.plan === 'pro'

  const [file, setFile] = useState<File | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [focal, setFocal] = useState<Focal>({ x: 0.5, y: 0.5 })
  const [ratio, setRatio] = useState<PFRatio>(PF_RATIOS[0])
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadFile = useCallback((f: File) => {
    setMessage(null)
    if (!f.type.startsWith('image/')) { setMessage('Please choose an image file.'); return }
    setFile(f)
    const img = new Image()
    img.onload = async () => { setImage(img); setFocal(await detectFocal(img)) }
    img.onerror = () => setMessage('Could not load that image.')
    img.src = URL.createObjectURL(f)
  }, [])

  async function pollUntilDone(jobId: string, signal: AbortSignal) {
    const deadline = Date.now() + 5 * 60 * 1000
    let fails = 0
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000))
      if (signal.aborted) return
      try {
        const res = await fetch(`/api/status?job_id=${encodeURIComponent(jobId)}`, { signal })
        if (!res.ok) { if (++fails > 10) throw new Error('status check failed'); continue }
        fails = 0
        const data = await res.json()
        const status = data.state ?? data.status
        if (status === 'done' || data.done === true) { setPhase('done'); return }
        if (status === 'error') throw new Error(data.error || 'Export failed')
        setPhase(status === 'running' ? 'running' : 'queued')
      } catch (e) {
        if (signal.aborted) return
        if (++fails > 10) throw e
      }
    }
    throw new Error('Timed out waiting for export')
  }

  async function handleExport() {
    if (!file || !image) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setMessage(null)
    try {
      setPhase('uploading')
      const up = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: await file.arrayBuffer(),
        signal: ac.signal,
      })
      if (!up.ok) throw new Error('Upload failed')
      const imageKey = (await up.json())?.image_key as string | undefined
      if (!imageKey) throw new Error('Upload returned no image_key')

      setPhase('queued')
      const enq = await fetch('/api/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_key: imageKey,
          group: ratio.group,
          mode: 'crop',
          focal: { x: focal.x, y: focal.y },
          artwork_name: file.name,
        }),
        signal: ac.signal,
      })
      if (enq.status === 402 || enq.status === 429) {
        const q = await enq.json().catch(() => ({}))
        throw new Error(q.message || 'Daily limit reached — upgrade to Pro for unlimited.')
      }
      if (!enq.ok) throw new Error('Could not start export')
      const jobId = (await enq.json())?.job_id as string | undefined
      if (!jobId) throw new Error('Enqueue returned no job_id')

      await pollUntilDone(jobId, ac.signal)

      const a = document.createElement('a')
      a.href = `/api/download?job_id=${encodeURIComponent(jobId)}&return_to=${encodeURIComponent('/perfect-fit')}`
      a.click()
    } catch (e) {
      if (ac.signal.aborted) return
      setPhase('error')
      setMessage(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  const busy = phase === 'uploading' || phase === 'queued' || phase === 'running'

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-white">
      <h1 className="text-2xl font-semibold">Perfect Fit</h1>
      <p className="mt-1 text-sm text-white/60">
        Crop to every print size around your subject — no stretching. Drag the image to set the focal point.
        {!isPro && <span className="text-amber-300"> Free exports are watermarked.</span>}
      </p>

      {!image && (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f) }}
          className="mt-8 flex h-56 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-white/20 text-white/60 hover:border-[#2DD4BF]/60"
        >
          Drop an image or click to upload
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
        </label>
      )}

      {image && (
        <div className="mt-8 space-y-6">
          <CropCanvas image={image} ratio={ratio} focal={focal} onFocalChange={setFocal} />
          <div className="flex flex-wrap gap-2">
            {PF_RATIOS.map((r) => (
              <button key={r.id} onClick={() => setRatio(r)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  ratio.id === r.id ? 'bg-[#2DD4BF] text-black' : 'ring-1 ring-white/15 text-white/80 hover:ring-white/40'
                }`}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExport} disabled={busy}
              className="rounded-lg bg-[#2DD4BF] px-4 py-2 font-medium text-black hover:opacity-90 disabled:opacity-50">
              {busy ? 'Exporting…' : `Export ${ratio.label} pack`}
            </button>
            <button onClick={() => { abortRef.current?.abort(); setImage(null); setFile(null); setPhase('idle'); setMessage(null) }}
              className="rounded-lg border border-white/20 px-4 py-2 text-white/80 hover:border-white/40">
              New image
            </button>
          </div>

          {(busy || phase === 'done') && (
            <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
              {busy && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-[#2DD4BF]" />
              )}
              <span className={phase === 'done' ? 'text-[#2DD4BF]' : 'text-white/70'}>
                {phase === 'done' ? '✓ ' : ''}
                {PHASE_LABEL[phase]}
              </span>
            </div>
          )}
        </div>
      )}

      {message && <p className="mt-4 text-sm text-red-400">{message}</p>}
    </div>
  )
}
