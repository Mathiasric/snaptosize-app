# Focal-Point Crop Preview (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a hidden, client-side `/crop-preview` page in `snaptosize-app` that auto-detects a subject focal point, draws live crop boxes for each Etsy ratio, lets the user click to override the focal point, and downloads the cropped result — with zero changes to existing modes/backend.

**Architecture:** Pure geometry (`crop.ts`) is unit-tested and mirrors the math Phase 2's Pillow `_crop_focal` will use. `smartcrop` is isolated behind `autoFocal.ts` with a center fallback. React client components handle canvas drawing and pointer interaction. A `noindex` server shell renders the client. Everything lives under one new route folder.

**Tech Stack:** Next.js 16 (app-dir), TypeScript, Tailwind 4, `smartcrop` (client), `vitest` (dev-only, for pure-geometry tests).

---

## Safety Invariants (verify continuously)

- Only NEW files under `app/crop-preview/**`, plus `package.json` / lockfile / one `vitest.config.ts`. **No existing source file edited.**
- Not added to `app/app/layout.tsx` MODES, `app/components/Header.tsx`, or any sitemap.
- No fetch to `/api/*` or any Worker/Runner call.
- `vitest` is a devDependency only — never in the production bundle; CF build runs `next build`, not vitest.

## File Structure

- `app/crop-preview/page.tsx` — server shell, `metadata.robots = noindex`, renders client
- `app/crop-preview/CropPreviewClient.tsx` — `'use client'`, owns state + upload + layout
- `app/crop-preview/components/CropCanvas.tsx` — draws image + selected crop box, click-to-set focal
- `app/crop-preview/components/RatioStrip.tsx` — per-ratio crop thumbnails
- `app/crop-preview/lib/ratios.ts` — Etsy ratio definitions (pure data)
- `app/crop-preview/lib/crop.ts` — pure geometry (`boxFor`) + canvas helpers
- `app/crop-preview/lib/autoFocal.ts` — `smartcrop` wrapper + pure `focalFromCrop`
- `app/crop-preview/lib/__tests__/crop.test.ts` — geometry unit tests
- `app/crop-preview/lib/__tests__/autoFocal.test.ts` — `focalFromCrop` unit tests
- `vitest.config.ts` — minimal vitest config (new, root)

---

### Task 1: Add dependencies + vitest scaffold

**Files:**
- Modify: `package.json` (add `smartcrop` dep, `vitest` devDep, `test` script)
- Create: `vitest.config.ts`

- [ ] **Step 1: Install deps**

Run:
```bash
cd /c/dev/snaptosize-app
npm install smartcrop
npm install -D vitest
```

- [ ] **Step 2: Add test script to package.json**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['app/crop-preview/lib/__tests__/**/*.test.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 4: Verify vitest runs (no tests yet = ok)**

Run: `npx vitest run`
Expected: "No test files found" or exit 0 — confirms vitest is wired.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore(crop-preview): add smartcrop + vitest (dev-only) for isolated crop tool"
```

---

### Task 2: Ratio definitions

**Files:**
- Create: `app/crop-preview/lib/ratios.ts`

- [ ] **Step 1: Write ratios.ts**

```ts
export type Ratio = { id: string; label: string; w: number; h: number }

// Standard Etsy print ratios (aspect only; Phase 1 is pixel-domain).
export const RATIOS: Ratio[] = [
  { id: '2x3', label: '2:3', w: 2, h: 3 },
  { id: '3x4', label: '3:4', w: 3, h: 4 },
  { id: '4x5', label: '4:5', w: 4, h: 5 },
  { id: '5x7', label: '5:7', w: 5, h: 7 },
  { id: '11x14', label: '11:14', w: 11, h: 14 },
  { id: 'iso', label: 'A (ISO)', w: 1000, h: 1414 },
]
```

- [ ] **Step 2: Commit**

```bash
git add app/crop-preview/lib/ratios.ts
git commit -m "feat(crop-preview): add Etsy ratio definitions"
```

---

### Task 3: Pure crop geometry (TDD)

**Files:**
- Create: `app/crop-preview/lib/crop.ts`
- Test: `app/crop-preview/lib/__tests__/crop.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { boxFor } from '../crop'

describe('boxFor', () => {
  it('returns a 2:3 box of full height on a square source, centered', () => {
    const box = boxFor(2, 3, { x: 0.5, y: 0.5 }, 300, 300)
    expect(box).toEqual({ x: 50, y: 0, width: 200, height: 300 })
  })

  it('clamps the box to the left edge when focal is at x=0', () => {
    const box = boxFor(2, 3, { x: 0, y: 0.5 }, 300, 300)
    expect(box.x).toBe(0)
    expect(box.width).toBe(200)
  })

  it('clamps the box to the right edge when focal is at x=1', () => {
    const box = boxFor(2, 3, { x: 1, y: 0.5 }, 300, 300)
    expect(box.x).toBe(100) // srcW(300) - width(200)
  })

  it('uses full width and crops height on a wide source for a 4:5 box', () => {
    const box = boxFor(4, 5, { x: 0.5, y: 0.5 }, 1000, 500)
    // target aspect 0.8; source aspect 2.0 (wider) -> full height 500, width 400
    expect(box).toEqual({ x: 300, y: 0, width: 400, height: 500 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/crop-preview/lib/__tests__/crop.test.ts`
Expected: FAIL — `boxFor` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/crop-preview/lib/__tests__/crop.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/crop-preview/lib/crop.ts app/crop-preview/lib/__tests__/crop.test.ts
git commit -m "feat(crop-preview): pure focal-point crop geometry with tests"
```

---

### Task 4: Auto focal-point detection (TDD on pure part)

**Files:**
- Create: `app/crop-preview/lib/autoFocal.ts`
- Test: `app/crop-preview/lib/__tests__/autoFocal.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { focalFromCrop } from '../autoFocal'

describe('focalFromCrop', () => {
  it('maps a crop rect to the normalized center of the rect', () => {
    const focal = focalFromCrop({ x: 100, y: 50, width: 200, height: 100 }, 400, 400)
    expect(focal).toEqual({ x: 0.5, y: 0.25 }) // center (200,100) / (400,400)
  })

  it('returns center for a full-image crop', () => {
    const focal = focalFromCrop({ x: 0, y: 0, width: 800, height: 600 }, 800, 600)
    expect(focal).toEqual({ x: 0.5, y: 0.5 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/crop-preview/lib/__tests__/autoFocal.test.ts`
Expected: FAIL — `focalFromCrop` not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/crop-preview/lib/__tests__/autoFocal.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/crop-preview/lib/autoFocal.ts app/crop-preview/lib/__tests__/autoFocal.test.ts
git commit -m "feat(crop-preview): smartcrop auto focal detection with center fallback"
```

---

### Task 5: CropCanvas component

**Files:**
- Create: `app/crop-preview/components/CropCanvas.tsx`

- [ ] **Step 1: Write CropCanvas.tsx**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { boxFor, type Focal, type Ratio } from '../lib/crop'
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

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    onFocalChange({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) })
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="cursor-crosshair rounded-lg border border-white/10"
    />
  )
}
```

NOTE: `crop.ts` must re-export `Ratio` type? No — import `Ratio` (RatioDef) from `ratios.ts`. Remove the unused `Ratio` import from crop in Step 1: change the import line to `import { boxFor, type Focal } from '../lib/crop'`.

- [ ] **Step 2: Fix the import line**

Ensure the top imports read exactly:
```tsx
import { boxFor, type Focal } from '../lib/crop'
import type { Ratio as RatioDef } from '../lib/ratios'
```

- [ ] **Step 3: Commit**

```bash
git add app/crop-preview/components/CropCanvas.tsx
git commit -m "feat(crop-preview): interactive crop canvas with click-to-set focal point"
```

---

### Task 6: RatioStrip component

**Files:**
- Create: `app/crop-preview/components/RatioStrip.tsx`

- [ ] **Step 1: Write RatioStrip.tsx**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add app/crop-preview/components/RatioStrip.tsx
git commit -m "feat(crop-preview): live per-ratio crop thumbnail strip"
```

---

### Task 7: CropPreviewClient (orchestration + upload + download)

**Files:**
- Create: `app/crop-preview/CropPreviewClient.tsx`

- [ ] **Step 1: Write CropPreviewClient.tsx**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add app/crop-preview/CropPreviewClient.tsx
git commit -m "feat(crop-preview): orchestrating client with upload, preview, and download"
```

---

### Task 8: Server shell page (noindex)

**Files:**
- Create: `app/crop-preview/page.tsx`

- [ ] **Step 1: Write page.tsx**

```tsx
import type { Metadata } from 'next'
import CropPreviewClient from './CropPreviewClient'

export const metadata: Metadata = {
  title: 'Smart Crop Preview',
  robots: { index: false, follow: false },
}

export default function CropPreviewPage() {
  return (
    <main className="min-h-screen bg-neutral-950">
      <CropPreviewClient />
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/crop-preview/page.tsx
git commit -m "feat(crop-preview): noindex server shell for hidden /crop-preview route"
```

---

### Task 9: Verify + safety review

**Files:** none (verification only)

- [ ] **Step 1: Run unit tests**

Run: `npx vitest run`
Expected: all crop + autoFocal tests PASS.

- [ ] **Step 2: Production build**

Run: `cd /c/dev/snaptosize-app && npx next build`
Expected: build succeeds; `/crop-preview` listed as a route.

- [ ] **Step 3: Manual / Playwright check on dev server**

Start dev server, open `http://localhost:3000/crop-preview`. Verify:
- Upload an image → auto crop box appears
- Click different spots → box + thumbnails follow the focal point
- Switch ratios → selected ratio updates the main canvas
- Download → file is the cropped region (open it, confirm)

- [ ] **Step 4: SAFETY REVIEW — prove nothing existing changed**

Run: `cd /c/dev/snaptosize-app && git status --porcelain && git diff --stat HEAD~8`
Expected: every changed path is under `app/crop-preview/**`, `package.json`, `package-lock.json`, `vitest.config.ts`, or the two `docs/superpowers/**` files. **No existing source file in the diff.** If anything else appears, STOP.

- [ ] **Step 5: Confirm route is invisible**

Grep to prove `/crop-preview` is not referenced anywhere outside its own folder:
Run: `grep -rn "crop-preview" app/ --include="*.tsx" --include="*.ts" | grep -v "app/crop-preview/"`
Expected: NO output (route is not linked from nav/layout/anywhere).

- [ ] **Step 6: Hand back for preview deploy decision**

Report results. Do NOT push to prod until the user approves the preview → prod direct-link step.

---

## Self-Review Notes

- **Spec coverage:** upload (Task 7), auto focal (Task 4), per-ratio boxes (Tasks 3/5/6), manual click override (Task 5), client download (Task 7), hidden/noindex route (Task 8), no-backend + additive safety (Task 9). All spec sections mapped.
- **Type consistency:** `Focal` and `Box` defined in `crop.ts`, imported everywhere; `Ratio` defined in `ratios.ts`, imported as `RatioDef` in CropCanvas to avoid name clash; `focalFromCrop` reused by `detectFocal`.
- **No placeholders:** every code step contains complete code.
- **Phase 2 untouched:** no Worker/Runner work in this plan.
