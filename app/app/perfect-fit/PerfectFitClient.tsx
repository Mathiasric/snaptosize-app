'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { usePostHog } from 'posthog-js/react'
import { BadgeCheck, Check, Crop, Layers, UploadCloud } from 'lucide-react'
import { PF_RATIOS, type PFRatio } from './lib/ratios'
import { type Focal } from '../../crop-preview/lib/crop'
import { detectFocal } from '../../crop-preview/lib/autoFocal'
import CropCanvas from '../../crop-preview/components/CropCanvas'
import RatioStrip from '../../crop-preview/components/RatioStrip'

type Phase = 'idle' | 'uploading' | 'queued' | 'running' | 'done' | 'error'

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  uploading: 'Reading your artwork…',
  queued: 'Queued…',
  running: 'Tailoring every print size…',
  done: 'Your print-ready pack is downloading',
  error: '',
}

export default function PerfectFitClient() {
  const { user } = useUser()
  const isPro = (user?.publicMetadata as { plan?: string } | undefined)?.plan === 'pro'
  const posthog = usePostHog()

  const [file, setFile] = useState<File | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [focal, setFocal] = useState<Focal>({ x: 0.5, y: 0.5 })
  const [ratio, setRatio] = useState<PFRatio>(PF_RATIOS[0])
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const abortRef = useRef<AbortController | null>(null)
  // Track whether the seller dragged the crop (vs. trusting auto-focal) — UX signal.
  const focalAdjustedRef = useRef(false)

  const loadFile = useCallback((f: File) => {
    setMessage(null)
    // Runner (Pillow) reliably handles only JPG/PNG/WEBP. Extension fallback covers
    // valid files with an empty/odd MIME; block others up front, not at the runner.
    const supported = ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name)
    if (!supported) { setMessage('Use a JPG, PNG, or WEBP file.'); return }
    setFile(f)
    focalAdjustedRef.current = false
    const img = new Image()
    img.onload = async () => {
      setImage(img)
      setFocal(await detectFocal(img))
      posthog?.capture('perfect_fit_image_uploaded', { plan: isPro ? 'pro' : 'free', source: 'perfect_fit' })
    }
    img.onerror = () => setMessage('Could not load that image.')
    img.src = URL.createObjectURL(f)
  }, [posthog, isPro])

  function reset() {
    abortRef.current?.abort()
    setImage(null); setFile(null); setPhase('idle'); setMessage(null)
    focalAdjustedRef.current = false
  }

  function handleFocalChange(f: Focal) {
    focalAdjustedRef.current = true
    setFocal(f)
  }

  // Phase-driven progress. No real per-size progress without a backend change, so this
  // advances by stage plus a gentle creep during render (typical job ~9s), then completes.
  useEffect(() => {
    if (phase === 'uploading') { setProgress(20); return }
    if (phase === 'queued') { setProgress(45); return }
    if (phase === 'done') { setProgress(100); return }
    if (phase === 'running') {
      setProgress((p) => Math.max(p, 70))
      const id = setInterval(() => setProgress((p) => (p < 92 ? p + 1.5 : p)), 400)
      return () => clearInterval(id)
    }
    setProgress(0) // idle / error
  }, [phase])

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
    const plan = isPro ? 'pro' : 'free'
    const startedAt = Date.now()
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
          orientation: orientation === 'landscape' ? 'Landscape' : 'Portrait',
          artwork_name: file.name,
        }),
        signal: ac.signal,
      })
      if (enq.status === 402 || enq.status === 429) {
        posthog?.capture('rate_limit_hit', { kind: 'FREE_LIMIT', source: 'perfect_fit' })
        posthog?.capture('paywall_view', { trigger: 'FREE_LIMIT', plan })
        const q = await enq.json().catch(() => ({}))
        setPhase('error')
        setMessage(q.message || 'Daily free limit reached. Go Pro for unlimited exports.')
        return
      }
      if (!enq.ok) throw new Error('Could not start export')
      const jobId = (await enq.json())?.job_id as string | undefined
      if (!jobId) throw new Error('Enqueue returned no job_id')

      posthog?.capture('perfect_fit_export_started', {
        pack_template: ratio.group,
        file_count: ratio.count,
        focal_adjusted: focalAdjustedRef.current,
        orientation,
        plan,
        source: 'perfect_fit',
      })

      await pollUntilDone(jobId, ac.signal)
      if (ac.signal.aborted) return

      posthog?.capture('perfect_fit_export_completed', {
        pack_template: ratio.group,
        file_count: ratio.count,
        duration_ms: Date.now() - startedAt,
        orientation,
        plan,
        source: 'perfect_fit',
      })

      const a = document.createElement('a')
      a.href = `/api/download?job_id=${encodeURIComponent(jobId)}&return_to=${encodeURIComponent('/app/perfect-fit')}`
      a.click()
    } catch (e) {
      if (ac.signal.aborted) return
      posthog?.capture('perfect_fit_export_failed', {
        pack_template: ratio.group,
        reason: e instanceof Error ? e.message : 'unknown',
        plan,
        source: 'perfect_fit',
      })
      setPhase('error')
      setMessage(e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  const busy = phase === 'uploading' || phase === 'queued' || phase === 'running'

  return (
    <div className="mx-auto max-w-[980px] px-4 py-8 sm:py-10">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Perfect Fit</h1>
        <p className="mt-1.5 max-w-xl text-sm text-foreground/50">
          One artwork, framed to every Etsy print size. You choose what stays in frame.
        </p>
      </header>

      {!image && (
        <div className="mt-6 lg:mt-10">
          <div className="grid items-stretch gap-8 lg:grid-cols-[3fr_2fr]">
            {/* Hero: the only action that matters here */}
            <div className="flex flex-col">
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f) }}
                className="flex min-h-[15rem] w-full flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-center transition-colors hover:border-accent/40"
                style={{ background: 'radial-gradient(ellipse at center, #12101a 0%, #0b0b0f 100%)' }}
              >
                <UploadCloud className="h-7 w-7 text-foreground/55" />
                <div>
                  <div className="text-sm font-medium text-foreground/80">Drop your artwork, or click to choose</div>
                  <div className="mt-1 text-xs text-foreground/55">JPG, JPEG, PNG, or WEBP · see it framed to every size before you export</div>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
                />
              </label>
              {message && <p className="mt-3 text-sm text-error">{message}</p>}
            </div>

            {/* What you'll get — a mix of portrait and landscape so both read at a glance */}
            <div className="hidden lg:flex lg:flex-col lg:justify-center">
              <div className="text-xs font-medium uppercase tracking-wide text-foreground/55">What you&apos;ll get</div>
              <div className="mt-4 flex flex-wrap items-end gap-2.5">
                {PF_RATIOS.map((r) => {
                  const long = 64
                  const w = r.w >= r.h ? long : Math.round(long * (r.w / r.h))
                  const h = r.h >= r.w ? long : Math.round(long * (r.h / r.w))
                  return (
                    <div key={r.id} className="flex flex-col items-center gap-1.5">
                      <div className="overflow-hidden rounded-md border border-foreground/20" style={{ width: w, height: h }}>
                        {/* Same sample art cropped to every ratio — shows "one upload, every size". */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/perfect-fit-sample.jpg" alt="" className="h-full w-full object-cover object-[50%_38%]" />
                      </div>
                      <span className="text-[10px] text-foreground/55">{r.label}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3.5 flex items-center gap-2 text-[11px] text-foreground/55">
                <span className="flex items-end gap-1" aria-hidden="true">
                  <span className="block rounded-[2px] border border-foreground/30" style={{ width: 10, height: 14 }} />
                  <span className="block rounded-[2px] border border-foreground/30" style={{ width: 14, height: 10 }} />
                </span>
                Portrait or landscape
              </div>
              <p className="mt-3 max-w-xs text-xs leading-relaxed text-foreground/55">
                One upload, framed to every common Etsy ratio — each ZIP under Etsy&apos;s 20MB.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-foreground/55">
            <span className="flex items-center gap-1.5"><Layers size={14} className="text-accent-light" /> Every Etsy size, portrait or landscape</span>
            <span className="flex items-center gap-1.5"><Crop size={14} className="text-accent-light" /> Framed around your subject</span>
            <span className="flex items-center gap-1.5"><BadgeCheck size={14} className="text-accent-light" /> 300 DPI, print-ready</span>
          </div>
        </div>
      )}

      {image && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          {/* Workspace */}
          <div className="space-y-4">
            <div className="inline-flex rounded-lg border border-border p-0.5">
              {(['portrait', 'landscape'] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  aria-pressed={orientation === o}
                  className={`rounded-md px-3.5 py-2.5 text-xs font-medium capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 ${
                    orientation === o ? 'bg-accent/15 text-accent-light' : 'text-foreground/50 hover:text-foreground/80'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
            <CropCanvas image={image} ratio={ratio} focal={focal} onFocalChange={handleFocalChange} landscape={orientation === 'landscape'} />

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleExport}
                disabled={busy}
                className={`gradient-btn inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                  busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:shadow-lg hover:shadow-accent/20'
                }`}
              >
                {busy ? 'Working…' : `Export ${ratio.label} pack`}
              </button>
              <button onClick={reset} className="rounded-lg px-3 py-2 text-sm text-foreground/55 transition-colors hover:bg-foreground/5 hover:text-foreground">
                New image
              </button>
            </div>

            <p className="text-xs text-foreground/55">
              {ratio.count} print sizes · 300 DPI · exact Etsy dimensions
            </p>

            {(busy || phase === 'done') && (
              <div role="status" aria-live="polite" className="max-w-xs space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  {phase === 'done' && <Check size={14} className="text-success" />}
                  <span className={phase === 'done' ? 'text-success' : 'text-foreground/70'}>{PHASE_LABEL[phase]}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${phase === 'done' ? 'bg-success' : 'bg-accent'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {phase === 'error' && message && <p className="text-sm text-error">{message}</p>}

            {!isPro && (
              <div className="rounded-xl border border-accent/20 bg-accent/[0.05] p-4">
                <div className="text-sm font-medium text-foreground/90">That&apos;s watermarked. Pro isn&apos;t.</div>
                <p className="mt-0.5 text-xs text-foreground/50">
                  Free exports include a SnapToSize watermark. Go Pro for clean, sell-ready files.
                </p>
                <a
                  href="/app/billing?source=perfect-fit"
                  className="gradient-btn mt-2.5 inline-flex rounded-lg px-4 py-2.5 text-xs font-semibold text-white"
                >
                  Remove the watermark →
                </a>
              </div>
            )}
          </div>

          {/* All-ratios rail — the value made visible */}
          <aside className="space-y-2.5">
            <div className="text-xs font-medium uppercase tracking-wide text-foreground/55">Your art · every size</div>
            <RatioStrip
              image={image}
              focal={focal}
              ratios={PF_RATIOS}
              selectedId={ratio.id}
              onSelect={(id) => setRatio(PF_RATIOS.find((r) => r.id === id) ?? PF_RATIOS[0])}
              landscape={orientation === 'landscape'}
            />
            <p className="pt-1 text-xs leading-relaxed text-foreground/50">
              Each export is a full pack of print sizes, framed around your subject.
            </p>
          </aside>
        </div>
      )}
    </div>
  )
}
