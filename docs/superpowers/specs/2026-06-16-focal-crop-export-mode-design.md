# Focal-Crop Export Mode — Design Spec

**Date:** 2026-06-16
**Status:** Draft for review
**Scope:** New, hidden, additive export mode across 3 repos (app + worker + runner). Phase 2 of the crop-preview work.

---

## 1. Why (customer-validated)

A paying subscriber (Georgiana, realistic animal artwork) churned and told us exactly what's missing. Her words, distilled:

> Ideal workflow: an export mode where the user can choose between
> 1. **Preserve full composition** (today's resize/stretch)
> 2. **Auto-crop to the selected aspect ratio, preserving proportions** (no distortion)
> 3. **Preview and adjust the crop position before export**
>
> "I work with realistic animal artwork, so even slight stretching becomes very noticeable."

This is the focal-crop concept, validated almost word-for-word. It is a **retention + Pro-conversion** feature, not a toy.

### Ground truth about the current product (verified firsthand)
- **Core packs + single export Lanczos-*stretch* to exact 300-DPI dimensions** (`runner/main.py:696`, `:830`). Different aspect → distortion. Barely visible on small aspect deltas, obvious on 2:3 → 4:5.
- **`_smart_fill` letterbox (`main.py:525`) has ZERO callers** — dead code from a failed mode experiment. It is NOT the core behavior.
- So this feature is **not** "fill vs fit bars" and **not** "rescue subjects from cropping." It is: *stretch (keep all, distort)* vs *crop (no distortion, lose outer slivers)* — the classic, honest resize trade-off.

---

## 2. What we're building

A new **"[NAME TBD]" mode**: a focal-crop variant of packs, worked **one ratio at a time**.

**Workflow (per-ratio, deliberate framing — matches user's "crop and run pack, one and one"):**
1. Upload image once.
2. Pick one target ratio (2:3, 3:4, 4:5, ISO, …).
3. Live client-side preview shows that ratio's crop box; auto focal point from smartcrop; **drag to reframe** the subject for that ratio.
4. **Export that ratio's pack** → backend crops the *original* to that aspect around the focal point, then generates every print size sharing that aspect (e.g. 2:3 → 4×6, 6×9, 8×12, 10×15, 12×18, …) at exact 300-DPI, **no distortion**, as a ZIP.
5. Switch ratio, reframe, export again.

Why per-ratio (not one-click-all): within one aspect, every size is the *same* crop just scaled, and the seller gets to frame each ratio deliberately. "Crop once then run through packs" is rejected — packs would re-stretch the crop back to other aspects, re-introducing distortion.

---

## 3. Architecture (additive, isolation-first)

> **Hard constraint:** the existing `single`, `pack`/custom (my-packs), and quick-export paths are **not edited**. New mode = new sibling branch + duplicated inline logic + reused read-only helpers. Existing modes proven **byte-identical** (Phase-1-style diff proof) before ship.

### 3a. App (`snaptosize-app`)
- New hidden route (e.g. `app/crop-export/`), **not in nav** (like Phase 1 `/crop-preview`), `noindex`.
- Reuses the Phase 1 picker components (`CropCanvas`, `RatioStrip`, `crop.ts`, `autoFocal.ts`), upgraded:
  - **Click → drag** for focal positioning (smoother; replaces the current jump-to-click).
- **REMOVE the Phase 1 client-side full-res download** in this mode (advisor #2). Export goes through `/api/enqueue` → Worker → Runner so watermark/plan/DPI/ZIP rules apply. The client canvas (≤560px) is preview-only and print-useless by design.
- "Export [ratio] pack" posts `{ image_key, group, mode: "crop", focal: {x,y}, orientation }` to the existing enqueue route.

### 3b. Worker (`snaptosize-worker`) — additive-safe, verified
- `payload: body` (`index.ts:1002`) already forwards the whole body → `focal` passes through with **no Worker change required for transport**.
- No mode allowlist; `jobMode` defaults to `"pack"`, only special-cases `"single"` → `mode:"crop"` is accepted and treated as batch.
- Watermark is **server-controlled**: free → `body.demo = true` (`index.ts:~989`). Free users therefore get **watermarked** crop ZIPs; Pro get clean — consistent with all modes.
- **Additive edits only** (each with byte-identical proof for existing modes):
  - (Optional, decision §5.1) Pro-only gate for `mode:"crop"` exports, or let free export watermarked.
  - (Optional) Give crop its own daily quota instead of sharing the packs `batch` counter.

### 3c. Runner (`snaptosize-worker/services/runner/main.py`) — new sibling branch
- Add `mode == "crop"` branch **alongside** (not inside) the `single` and `pack` branches.
- New pure function **`_crop_focal(img, target_w, target_h, focal) -> Image`**: crop the source to the target aspect around the normalized focal point (clamped to bounds), then `resize` to exact `(target_w, target_h)` with LANCZOS. **No stretch.**
- **Duplicate** (not refactor — advisor #3) the inline pack ZIP/quality-fallback loop (`main.py:840-868`) into the new branch; the existing pack branch's inline loop is left untouched.
- **Reuse** read-only helpers/data: `PACK_SIZES`, `ISO_CM_MAP`, filename/label logic, `upload_zip_to_r2`, `_write_kv_done`, and **`_apply_demo_watermark`** (must be applied in the new branch too — do not forget the watermark).

### Data flow
`Picker (app) → /api/enqueue → Worker (/enqueue: quota, watermark flag, payload:body) → Runner (/generate: mode=="crop" → _crop_focal per size → ZIP → R2) → KV done → app polls → download`

---

## 4. Invariants (derived from adversarial review — must hold)

1. **Geometry parity is the correctness gate.** `_crop_focal` (Python) and `boxFor` (`crop.ts`) MUST produce identical boxes — same rounding, same corner-clamping. Define **one shared table of test vectors** (focal + src dims → expected box) and assert it in BOTH the vitest suite AND new pytest. "Preview == export" is the entire promise; prove it before any UI polish.
2. **No client-side full-res export.** Print-resolution crop exists **only server-side**, behind the watermark/plan gate. The ≤560px preview canvas is the only client output.
3. **Duplicate, don't refactor.** The live pack/single branches are not edited. New logic is duplicated and labeled deliberate.
4. **Existing modes byte-identical.** Before ship: `git diff` proof that no existing source path changed behavior (Phase-1 discipline), plus runtime 200-checks on quick-export/packs/my-packs.
5. **Resolution/DPI guard.** Crop discards pixels *then* upscales to exact dims — a small upload cropped to 4:5 → 24×30 (7200×9000) prints soft. Decision §5.4.

---

## 5. Open decisions (recommendations — confirm at review)

### 5.1 Plan gating
**Recommended:** Free can upload + see the live crop preview; **export routes through enqueue** so free gets a **watermarked** ZIP, Pro gets clean (zero new gate, rides existing system). Optionally harden to **Pro-only export** if we'd rather make it a pure upgrade lever. *(Pricing call — yours.)*

### 5.2 Ratio set for v1
**Recommended v1:** `2:3, 3:4, 4:5, ISO` — these already have full size-ladders in `PACK_SIZES`, zero new product data. **Fast-follow:** `5:7` and `11:14` once we define their size ladders (currently single EXTRAS entries, not ladders).

### 5.3 Landscape
**Recommended:** **Portrait-only v1.** The Runner already has a landscape width/height swap in custom mode → clean v2 addition; keep it out of the first cut to halve QA surface.

### 5.4 Resolution guard
**Recommended:** Warn (or skip) when the cropped region falls below the 300-DPI pixel count for a requested size, so we never silently ship soft large prints to quality-driven buyers.

### 5.5 Name
Positive + descriptive. Shortlist: **"Perfect Fit"** (lean), "Frame Perfect", "True Crop", "Crop & Pack".

---

## 6. Out of scope (v1)
- Landscape orientation (v2).
- Per-ratio independent focal points (v1 = one global focal, reframable per ratio before each export).
- AI upscaling for low-res sources (separate feature).
- Any change to single / packs / my-packs / quick-export behavior.
- Nav/menu exposure (hidden until tested + approved).

---

## 7. Testing & rollout
- **Unit:** shared geometry vectors (vitest + pytest), `_crop_focal` edge/corner clamping, watermark applied on free path.
- **Integration:** enqueue → runner → ZIP for `mode:"crop"`; confirm existing modes unchanged (byte-identical diff + runtime 200s).
- **Visual:** Playwright on the hidden route — upload landscape off-center photo, confirm crop lands on subject (smartcrop not silently centering), preview matches a downloaded server crop.
- **Rollout:** feature branch + **reverse commit kept nearby at every step**; ship via **Playwright CLI + a preview deploy first**; advisor consulted at design + pre-merge gates; merge only after explicit approval. Nothing reaches `app.snaptosize.com` until approved.
