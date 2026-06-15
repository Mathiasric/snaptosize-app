# Focal-Point Crop Preview — Phase 1 Design Spec

> Repo: `snaptosize-app` (app.snaptosize.com) · Date: 2026-06-14
> Source brief: `snaptosize-website/docs/crop-mode-research-brief.md`
> Status: Phase 1 of a staged rollout. Frontend-only. Zero backend changes.

---

## 1. Goal & Non-Goals

**Goal:** Ship a hidden, direct-link-only page that lets a user upload an image, see
a smart focal-point crop for every standard Etsy print ratio, manually override the
focal point by clicking, and download the cropped result — all client-side. This is a
**visual proof-of-concept** to validate the focal-point crop UX before investing in
the print-ready export pipeline.

This serves the long-term product goal: SnapToSize becoming the only web SaaS with
300 DPI + smart focal-point crop + Etsy-native ratios. Phase 1 validates the crop UX
that closes the market gap; it is not a throwaway — its crop-geometry and focal-point
component are the same logic Phase 2's backend will mirror.

**Phase 1 explicitly DOES:**
- Upload (drag-drop + file input), client-side only — no `/api/upload` call
- Auto-detect subject focal point via `smartcrop`
- Render live crop rectangles for each Etsy ratio around the focal point
- Manual focal-point override by clicking the image → boxes re-render live
- Download a single cropped image client-side at full source resolution

**Phase 1 explicitly does NOT (deferred to Phase 2, separate approval):**
- Produce the 300 DPI multi-ratio Etsy ZIP
- Touch the Worker, Runner, `/api/*` routes, or any existing resize mode
- Appear in nav, sitemap, or any user-discoverable surface
- Require sign-in / consume quota

## 2. Safety Contract (non-negotiable)

This feature must not affect active users or the existing export modes in any way.

- **Purely additive:** one new route folder + one `package.json` dependency line. No
  existing file is edited. Existing modes (preset size-packs, Worker `/enqueue`,
  Runner `make_print_sets.py`, `_smart_fill`, Magic Wand) are untouched.
- **Hidden:** new route at `app/crop-preview/` → `/crop-preview`. NOT added to the
  `MODES` array in `app/app/layout.tsx`, NOT in any nav (`app/components/Header.tsx`),
  no sitemap exists to update.
- **Public, no redirect:** `middleware.ts` protects only `/app/billing` and
  `/app/dashboard`. `/crop-preview` is unmatched → public, no Clerk redirect. The page
  must not call any protected API.
- **No backend calls:** everything runs in the browser. No fetch to `/api/*`.
- **Rollout gate:** local Playwright verify → CF Pages preview → prod direct link only
  after a post-build safety review confirms zero existing-file changes.

## 3. Architecture

Next.js 16 app-dir, TypeScript, Tailwind 4 (matches repo). All new code lives under
`app/crop-preview/`.

```
app/crop-preview/
  page.tsx                      # Server component shell (metadata: noindex), renders client
  CropPreviewClient.tsx         # 'use client' — orchestrates state & layout
  components/
    CropCanvas.tsx              # Renders image + crop overlays, handles click-to-set focal point
    RatioStrip.tsx              # Per-ratio thumbnails of the resulting crop
  lib/
    ratios.ts                   # Etsy ratio definitions (single source of truth)
    crop.ts                     # Pure geometry: focal point + ratio -> crop box; canvas export
    autoFocal.ts                # smartcrop wrapper -> normalized focal point {x,y} in [0,1]
```

**Why these boundaries:**
- `crop.ts` is pure, dependency-free geometry — unit-testable, and it mirrors the exact
  math Phase 2's Pillow `_crop_focal` will use (`scale = max(...)`, clamp box to edges).
  Keeping it isolated means Phase 1 and Phase 2 share one verified algorithm.
- `autoFocal.ts` is the only place that imports `smartcrop`. If we ever swap the
  auto-detector (e.g. server-side AI in a later phase), only this file changes.
- `CropCanvas.tsx` owns all pointer interaction; `RatioStrip.tsx` is presentational.

## 4. Data Flow

1. User drops/selects a file → `URL.createObjectURL` → `<img>`/`ImageBitmap` loaded.
2. On load, `autoFocal.detect(image)` runs `smartcrop` once against a representative
   target to find the subject; returns a normalized focal point `{ x, y }` in `[0,1]`.
3. `crop.boxFor(ratio, focal, srcW, srcH)` computes, per ratio, the largest box of that
   aspect ratio centered on the focal point and clamped inside the image.
4. `CropCanvas` draws the source image + the currently-selected ratio's box; the
   `RatioStrip` shows a small rendered crop for every ratio.
5. Click on the canvas → maps pointer to normalized `{x,y}` → becomes the new focal
   point → steps 3–4 re-run synchronously (cheap, pure math).
6. Download → `crop.render(image, box)` draws to an offscreen canvas → `toBlob('image/png')`
   → triggers download at full source resolution for the selected ratio.

**Focal-point model:** a single normalized focal point drives all ratios (consistent
subject across crops). Per-ratio independent focal points are out of scope for Phase 1
(YAGNI — revisit only if validation shows users want it).

## 5. Ratios (single source of truth — `lib/ratios.ts`)

Standard Etsy print ratios used for the crop boxes (aspect only; Phase 1 is pixel-domain):

| Label | Ratio (w:h) | Example sizes |
|-------|-------------|---------------|
| 2:3   | 2 / 3       | 4×6, 8×12, 12×18, 24×36 |
| 3:4   | 3 / 4       | 6×8, 12×16, 18×24 |
| 4:5   | 4 / 5       | 8×10, 16×20 |
| 5:7   | 5 / 7       | 5×7 |
| 11:14 | 11 / 14     | 11×14 |
| ISO (A) | 1 / 1.4142 | A4, A3, A2, A1 |

Portrait orientation by default; the geometry handles landscape source images by
clamping. Orientation toggle is a possible nicety but not required for Phase 1.

## 6. `smartcrop` Dependency

- Package: `smartcrop` (MIT, client-side, ~the detector BIRME uses).
- Imported only in `lib/autoFocal.ts`. Loaded dynamically (`await import('smartcrop')`)
  inside the client component so it never enters any other bundle.
- Failure mode: if `smartcrop` throws or returns nothing, `autoFocal` falls back to
  center `{0.5, 0.5}`. The manual click override is always available regardless — it is
  the reliability backbone; smartcrop is the convenience layer.

## 7. Error Handling & Edge Cases

- Non-image / corrupt file → inline error message, no crash.
- Very large images → cap working dimension for the on-screen canvas (downscale for
  display); keep the original for full-res export. Memory-safe on mobile.
- Image smaller than a target box → box is the full image dimension on the constrained
  axis (clamped); never upscale-crop beyond source.
- `smartcrop` slow on huge images → run against a downscaled copy for detection only.
- SSR: page shell is server component with `export const metadata = { robots: 'noindex' }`;
  all canvas/image logic is in `'use client'` components.

## 8. Verification Plan

- **Unit:** `crop.ts` geometry — focal at corners/center, extreme aspect ratios, tiny/huge
  sources, clamping correctness. (Pure functions, fast.)
- **Manual / Playwright:** upload a test image, confirm auto box appears, click to move
  focal point and confirm boxes follow, download and confirm the file is the cropped
  region at source resolution.
- **Safety review (post-build):** `git status` in snaptosize-app shows ONLY the new
  `app/crop-preview/**` files + one `package.json`/lockfile change. Diff existing files =
  empty. Build passes (`next build`). Then preview → prod direct link.

## 9. Phase 2 (preview — NOT in scope now)

When Phase 1 validates the UX: add an isolated, additive Runner function
`_crop_focal(img, w, h, fp_x, fp_y)` + a new Worker mode param `crop_focal`, wired from
this same page to produce the real 300 DPI multi-ratio Etsy ZIP. Built with extreme care
per the runner-deploy rule (deploy only from `services/runner/`). Separate spec + approval.
