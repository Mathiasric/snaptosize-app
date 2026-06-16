# Perfect Fit — Hidden UI + Enqueue Wiring (Plan 2 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a hidden, not-in-nav `/perfect-fit` route in `snaptosize-app` that lets a user upload art, pick a ratio, drag to frame the subject, and **export a real focal-cropped pack** through the existing job pipeline (upload → enqueue `mode:"crop"` → poll → download) — so it can be tested live on the site behind a direct URL.

**Architecture:** Pure client-side. Reuses Phase 1 picker components (`CropCanvas`, `crop.ts`, `autoFocal.ts`) and the existing API routes (`/api/upload`, `/api/enqueue`, `/api/status`, `/api/download`) — all of which already pass `focal`/`mode` through unchanged. The crop math runs server-side in the Runner's `mode:"crop"` branch (Plan 1). No API, Worker, or Runner code changes.

**Tech Stack:** Next.js 16 (app-dir, edge), TypeScript, Tailwind 4, Clerk (plan detection), existing job-polling pattern from `quick-export`.

**Repo touched:** `snaptosize-app` only.

---

## Safety Invariants (verify continuously)

- Only NEW files under `app/perfect-fit/**`, plus ONE edit to the shared `app/crop-preview/components/CropCanvas.tsx` (drag upgrade — improves the Phase 1 tool too, no behavior removed).
- NOT added to nav / `Header.tsx` / any sitemap; route is `noindex`.
- No edit to `app/app/packs`, `quick-export`, `my-packs`, or any `/api/*` route.
- Export goes through the server pipeline ONLY — no client-side full-res download (the watermark/plan gate lives in the Worker).
- Requires the Runner `mode:"crop"` branch (Plan 1) to be DEPLOYED first, or crop jobs silently fall through to stretch.

## File Structure

- `app/perfect-fit/page.tsx` — server shell, `noindex`, renders client (NEW)
- `app/perfect-fit/PerfectFitClient.tsx` — `'use client'`, owns upload→enqueue→poll→download + state (NEW)
- `app/perfect-fit/lib/ratios.ts` — the 4 v1 ratios mapped to Runner `group` ids (NEW)
- `app/crop-preview/components/CropCanvas.tsx` — MODIFY: click → pointer drag

---

### Task 1: Perfect Fit ratio config (the 4 v1 ratios → Runner groups)

**Files:**
- Create: `app/perfect-fit/lib/ratios.ts`

- [ ] **Step 1: Capture the branch base, then write ratios.ts**

First record the base for Task 5's safety diff:
Run: `cd /c/dev/snaptosize-app && git rev-parse HEAD` → save as `PF_BASE`.

`group` MUST match a Runner `PACK_SIZES` key (`2x3`, `3x4`, `4x5`, `ISO`). `w,h` are the aspect for the crop box (ISO uses A-series 1000:1414).

```ts
// Perfect Fit v1 ratios. `group` maps to the Runner PACK_SIZES key that drives
// which exact print sizes the focal-cropped pack contains.
export type PFRatio = { id: string; label: string; w: number; h: number; group: string }

export const PF_RATIOS: PFRatio[] = [
  { id: '2x3', label: '2:3', w: 2, h: 3, group: '2x3' },
  { id: '3x4', label: '3:4', w: 3, h: 4, group: '3x4' },
  { id: '4x5', label: '4:5', w: 4, h: 5, group: '4x5' },
  { id: 'iso', label: 'A / ISO', w: 1000, h: 1414, group: 'ISO' },
]
```

- [ ] **Step 2: Commit**

```bash
cd /c/dev/snaptosize-app
git add app/perfect-fit/lib/ratios.ts
git commit -m "feat(perfect-fit): v1 ratio config mapped to Runner pack groups"
```

---

### Task 2: Upgrade CropCanvas from click to pointer-drag

**Files:**
- Modify: `app/crop-preview/components/CropCanvas.tsx`

- [ ] **Step 1: Read the current handler**

Run: `cd /c/dev/snaptosize-app && sed -n '344,360p' app/crop-preview/components/CropCanvas.tsx`
Expected to see `handleClick` + the returned `<canvas onClick={handleClick} ... />`.

- [ ] **Step 2: Replace click-only with pointer drag (set focal on press AND while dragging)**

Replace the `handleClick` function and the `<canvas>` element with:

```tsx
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
```

- [ ] **Step 3: Verify the Phase 1 page still compiles + works**

Run: `cd /c/dev/snaptosize-app && npx next build 2>&1 | tail -5`
Expected: build succeeds; `/crop-preview` and (after later tasks) `/perfect-fit` both listed.

- [ ] **Step 4: Commit**

```bash
cd /c/dev/snaptosize-app
git add app/crop-preview/components/CropCanvas.tsx
git commit -m "feat(crop-preview): pointer-drag focal positioning (smoother than click)"
```

---

### Task 3: PerfectFitClient — upload → enqueue(mode:crop) → poll → download

**Files:**
- Create: `app/perfect-fit/PerfectFitClient.tsx`

- [ ] **Step 1: Write PerfectFitClient.tsx**

Mirrors the `quick-export` flow (upload raw bytes → enqueue → poll `?job_id=` at 1s/5min → download proxy). Reuses `CropCanvas`, `detectFocal`, and `boxFor` types from the Phase 1 lib.

```tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { PF_RATIOS, type PFRatio } from './lib/ratios'
import { type Focal } from '../crop-preview/lib/crop'
import { detectFocal } from '../crop-preview/lib/autoFocal'
import CropCanvas from '../crop-preview/components/CropCanvas'

type Phase = 'idle' | 'uploading' | 'queued' | 'running' | 'done' | 'error'

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
            {phase === 'done' && <span className="text-sm text-[#2DD4BF]">Done — download started.</span>}
          </div>
        </div>
      )}

      {message && <p className="mt-4 text-sm text-red-400">{message}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/dev/snaptosize-app
git add app/perfect-fit/PerfectFitClient.tsx
git commit -m "feat(perfect-fit): client — upload, focal pick, enqueue crop pack, poll, download"
```

---

### Task 4: Hidden server shell page (noindex)

**Files:**
- Create: `app/perfect-fit/page.tsx`

- [ ] **Step 1: Write page.tsx**

```tsx
import type { Metadata } from 'next'
import PerfectFitClient from './PerfectFitClient'

export const metadata: Metadata = {
  title: 'Perfect Fit',
  robots: { index: false, follow: false },
}

export default function PerfectFitPage() {
  return (
    <main className="min-h-screen bg-neutral-950">
      <PerfectFitClient />
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /c/dev/snaptosize-app
git add app/perfect-fit/page.tsx
git commit -m "feat(perfect-fit): noindex server shell for hidden /perfect-fit route"
```

---

### Task 5: Build + safety review

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `cd /c/dev/snaptosize-app && npx next build 2>&1 | tail -25`
Expected: build succeeds; `/perfect-fit` listed as a route; `/crop-preview` still present; no type errors.

- [ ] **Step 2: Prove the route is invisible (not linked anywhere outside its folder)**

Run: `cd /c/dev/snaptosize-app && grep -rn "perfect-fit" app/ --include="*.tsx" --include="*.ts" | grep -v "app/perfect-fit/"`
Expected: NO output (not in nav/layout/sitemap).

- [ ] **Step 3: Confirm only additive changes + the one CropCanvas edit**

Run: `cd /c/dev/snaptosize-app && git diff --stat $PF_BASE HEAD` (using the `PF_BASE` hash recorded in Task 1 Step 1)
Expected: changed paths are all under `app/perfect-fit/**` plus exactly one shared file `app/crop-preview/components/CropCanvas.tsx`. No `app/app/**` or `app/api/**` changes.

- [ ] **Step 4: Re-run JS unit suite (geometry unaffected)**

Run: `cd /c/dev/snaptosize-app && npx vitest run 2>&1 | tail -6`
Expected: all crop + crop-vectors + autoFocal tests still pass.

- [ ] **Step 5: Hand back for live test**

Report results. The route is built and hidden. **Do NOT add to nav.** Live test requires:
1. Runner `mode:"crop"` (Plan 1) DEPLOYED to staging → verified → prod (deploy from `services/runner/`, never root).
2. App merged to `main` (hidden route auto-deploys to prod via CF Pages).
3. Visit `app.snaptosize.com/perfect-fit` directly: upload → drag focal → Export → confirm the downloaded ZIP is focal-cropped (undistorted) at exact print sizes, watermarked for free / clean for Pro.

---

## Self-Review Notes

- **Spec coverage:** upload+enqueue+poll+download via existing pipeline (Task 3); reuse Phase 1 picker (Tasks 1–3); click→drag (Task 2); free=watermarked rides existing Worker (no gate code needed — Task 3 shows messaging only); hidden noindex not-in-nav (Tasks 4–5); 4-ratio v1 mapped to PACK_SIZES groups (Task 1). Resolution guard + 5:7/11:14 + landscape are explicit fast-follows (out of scope).
- **Type consistency:** `PFRatio` carries `{id,label,w,h,group}`; `CropCanvas` reads only `ratio.w/ratio.h` (structurally compatible). `Focal` imported from `crop-preview/lib/crop`. Enqueue body matches the Worker's `payload: body` pass-through and the Runner `mode=="crop"` reader (`group`, `focal.x/y`).
- **No placeholders:** every code step is complete. `<branch-base>` in Task 5 Step 3 is captured at Task 1 start.
- **Out of scope:** Pro-only gate, resolution/DPI warning, 5:7 & 11:14 ladders, landscape, nav exposure, retiring the Phase 1 `/crop-preview` tool.
```
