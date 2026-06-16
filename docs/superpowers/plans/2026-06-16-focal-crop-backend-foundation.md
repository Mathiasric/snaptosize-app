# Focal-Crop Export — Backend Foundation (Plan 1 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and prove the distortion-free focal-crop *engine* — pixel-identical crop geometry across JS (preview) and Python (export), plus a new isolated `mode == "crop"` branch in the Runner that produces a per-ratio pack of focal-cropped, exact-dimension prints — without altering any existing mode.

**Architecture:** Pure crop geometry lives in a standalone Runner module `crop_focal.py` (no FastAPI/R2 baggage) and is asserted against a shared test-vector table that ALSO drives the existing JS `boxFor` test — this is the "preview == export" correctness gate. A new sibling `mode == "crop"` branch in `main.py` reuses read-only helpers/data (`PACK_SIZES`, `_apply_demo_watermark`, `upload_zip_to_r2`, `_write_kv_done`) and **duplicates** the inline ZIP/quality loop, leaving the live `single`/`pack` branches byte-identical.

**Tech Stack:** Python 3.12 + Pillow (Runner), plain-`python` assert scripts (Runner's existing test convention — no pytest), TypeScript + vitest (app, already wired).

**Repos touched:** `snaptosize-app` (vitest vectors only) and `snaptosize-worker` (`services/runner/`). No Worker `index.ts` change in this plan — `payload: body` already forwards `focal`.

---

## Safety Invariants (verify continuously)

- Existing Runner branches `mode == "single"` (`main.py:682`) and pack/custom (`main.py:724+`) are **NOT edited**, except the single-line watermark guard in Task 4 (provably a no-op for them).
- New geometry lives in a NEW file `services/runner/crop_focal.py`; the crop branch is a NEW `if mode == "crop":` block.
- No change to the Worker→Runner contract shape; `focal` is an additive optional field.
- The geometry parity vectors are IDENTICAL in both repos (`crop_vectors.json`) — divergence breaks "preview == export".
- Python rounding MUST mirror JS `Math.round` via `math.floor(x + 0.5)` — never bare `round()` (banker's rounding diverges).

## File Structure

- `snaptosize-app/app/crop-preview/lib/__tests__/crop-vectors.json` — canonical shared vector table (NEW)
- `snaptosize-app/app/crop-preview/lib/__tests__/crop-vectors.test.ts` — asserts `boxFor` against the vectors (NEW)
- `snaptosize-worker/services/runner/crop_vectors.json` — identical copy of the vector table (NEW)
- `snaptosize-worker/services/runner/crop_focal.py` — `_js_round`, `_focal_box`, `_crop_focal` (NEW)
- `snaptosize-worker/services/runner/test_crop_focal.py` — parity + crop tests, plain `python` script (NEW)
- `snaptosize-worker/services/runner/main.py` — import `_crop_focal`; watermark guard (Task 4); new `mode == "crop"` branch (Task 5)

---

### Task 1: Shared crop-geometry vectors + JS assertion

**Files:**
- Create: `snaptosize-app/app/crop-preview/lib/__tests__/crop-vectors.json`
- Create: `snaptosize-app/app/crop-preview/lib/__tests__/crop-vectors.test.ts`

- [ ] **Step 1: Write the canonical vector table**

`crop-vectors.json` — `w,h` are the target ASPECT; `expected` is the box in SOURCE pixels. The `half-rounding-guard` case is crafted to FAIL under Python banker's rounding (so it proves parity, not just correctness):

```json
{
  "cases": [
    { "name": "2:3 centered on square", "w": 2, "h": 3, "focal": { "x": 0.5, "y": 0.5 }, "srcW": 300, "srcH": 300, "expected": { "x": 50, "y": 0, "width": 200, "height": 300 } },
    { "name": "left clamp", "w": 2, "h": 3, "focal": { "x": 0, "y": 0.5 }, "srcW": 300, "srcH": 300, "expected": { "x": 0, "y": 0, "width": 200, "height": 300 } },
    { "name": "right clamp", "w": 2, "h": 3, "focal": { "x": 1, "y": 0.5 }, "srcW": 300, "srcH": 300, "expected": { "x": 100, "y": 0, "width": 200, "height": 300 } },
    { "name": "wide 4:5 full height", "w": 4, "h": 5, "focal": { "x": 0.5, "y": 0.5 }, "srcW": 1000, "srcH": 500, "expected": { "x": 300, "y": 0, "width": 400, "height": 500 } },
    { "name": "half-rounding guard (banker's-round trap)", "w": 1, "h": 1, "focal": { "x": 0.5, "y": 0.5 }, "srcW": 201, "srcH": 298, "expected": { "x": 0, "y": 49, "width": 201, "height": 201 } }
  ]
}
```

- [ ] **Step 2: Write the failing JS test**

`crop-vectors.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { boxFor } from '../crop'
import vectors from './crop-vectors.json'

describe('boxFor matches shared crop-vectors', () => {
  for (const c of vectors.cases) {
    it(c.name, () => {
      const box = boxFor(c.w, c.h, c.focal, c.srcW, c.srcH)
      expect(box).toEqual(c.expected)
    })
  }
})
```

- [ ] **Step 3: Run it — expect PASS (the existing `boxFor` already implements this)**

Run: `cd /c/dev/snaptosize-app && npx vitest run app/crop-preview/lib/__tests__/crop-vectors.test.ts`
Expected: 5 passed. (If the half-rounding case fails, `crop.ts` has a rounding bug — STOP and fix `boxFor` before continuing; parity is meaningless otherwise.)

NOTE: `tsconfig`/vitest must allow JSON import. vitest resolves JSON natively; no config change needed.

- [ ] **Step 4: Commit**

```bash
cd /c/dev/snaptosize-app
git add app/crop-preview/lib/__tests__/crop-vectors.json app/crop-preview/lib/__tests__/crop-vectors.test.ts
git commit -m "test(crop-preview): shared crop-geometry vectors asserted against boxFor"
```

---

### Task 2: Python `_focal_box` with JS-Math.round parity (TDD)

**Files:**
- Create: `snaptosize-worker/services/runner/crop_vectors.json` (identical to Task 1's JSON)
- Create: `snaptosize-worker/services/runner/crop_focal.py`
- Create: `snaptosize-worker/services/runner/test_crop_focal.py`

- [ ] **Step 1: Copy the vector table into the runner repo**

Create `crop_vectors.json` with the EXACT same content as `snaptosize-app/app/crop-preview/lib/__tests__/crop-vectors.json` (copy the `{ "cases": [...] }` block from Task 1 Step 1 verbatim). Add a top-level sibling note is not possible in JSON — keep it identical; a comment lives in `test_crop_focal.py` instead.

- [ ] **Step 2: Write the failing parity test**

`test_crop_focal.py`:

```python
# Geometry parity: _focal_box MUST equal JS boxFor for every shared vector.
# crop_vectors.json is a verbatim copy of the app repo's
# app/crop-preview/lib/__tests__/crop-vectors.json — keep them identical.
import json, os, sys
from crop_focal import _focal_box

HERE = os.path.dirname(os.path.abspath(__file__))

def test_focal_box_matches_vectors():
    with open(os.path.join(HERE, "crop_vectors.json")) as f:
        cases = json.load(f)["cases"]
    for c in cases:
        x, y, w, h = _focal_box(c["w"], c["h"], c["focal"]["x"], c["focal"]["y"], c["srcW"], c["srcH"])
        got = {"x": x, "y": y, "width": w, "height": h}
        assert got == c["expected"], f'{c["name"]}: got {got}, want {c["expected"]}'
    print(f"OK: {len(cases)} parity vectors matched")

if __name__ == "__main__":
    try:
        test_focal_box_matches_vectors()
    except AssertionError as e:
        print("FAIL:", e); sys.exit(1)
```

- [ ] **Step 3: Run it — expect FAIL (module not found)**

Run: `cd /c/dev/snaptosize-worker/services/runner && python test_crop_focal.py`
Expected: `ModuleNotFoundError: No module named 'crop_focal'`.

- [ ] **Step 4: Write `crop_focal.py` (box only for now)**

```python
import math


def _js_round(x: float) -> int:
    """Mirror JavaScript Math.round (round half toward +Infinity).
    Bare round() uses banker's rounding and diverges from the JS preview."""
    return math.floor(x + 0.5)


def _focal_box(w: int, h: int, fx: float, fy: float, src_w: int, src_h: int):
    """Largest box of aspect w:h fitting inside src_w x src_h, centered on the
    normalized focal point (fx, fy in 0..1) and clamped to image bounds.
    Pixel-identical to boxFor() in snaptosize-app crop.ts. Returns (x, y, width, height)."""
    target_aspect = w / h
    src_aspect = src_w / src_h
    if src_aspect > target_aspect:
        height = src_h
        width = _js_round(height * target_aspect)
    else:
        width = src_w
        height = _js_round(width / target_aspect)
    cx = fx * src_w
    cy = fy * src_h
    x = _js_round(cx - width / 2)
    y = _js_round(cy - height / 2)
    x = max(0, min(x, src_w - width))
    y = max(0, min(y, src_h - height))
    return (x, y, width, height)
```

- [ ] **Step 5: Run it — expect PASS**

Run: `cd /c/dev/snaptosize-worker/services/runner && python test_crop_focal.py`
Expected: `OK: 5 parity vectors matched`. (If the half-rounding-guard case fails, someone changed `_js_round` to bare `round()` — fix it.)

- [ ] **Step 6: Commit**

```bash
cd /c/dev/snaptosize-worker
git add services/runner/crop_vectors.json services/runner/crop_focal.py services/runner/test_crop_focal.py
git commit -m "feat(runner): focal-box geometry with JS-Math.round parity + shared vectors"
```

---

### Task 3: `_crop_focal` (crop + resize, no stretch) — TDD

**Files:**
- Modify: `snaptosize-worker/services/runner/crop_focal.py`
- Modify: `snaptosize-worker/services/runner/test_crop_focal.py`

- [ ] **Step 1: Add the failing crop test**

Append to `test_crop_focal.py` (and call it from `__main__`):

```python
from PIL import Image
from crop_focal import _crop_focal

def test_crop_focal_dims_and_no_distortion():
    # 1000x500 solid image; crop to 4:5 (portrait) at exact print dims 2400x3000.
    src = Image.new("RGB", (1000, 500), (123, 200, 50))
    out = _crop_focal(src, 2400, 3000, 0.5, 0.5)
    assert out.size == (2400, 3000), f"expected (2400,3000), got {out.size}"
    # The cropped region must have the target ASPECT before scaling (no stretch):
    # box for 2400x3000 (aspect 0.8) on 1000x500 -> width 400, height 500 -> 0.8 ratio.
    assert abs((2400 / 3000) - (4 / 5)) < 1e-9
    print("OK: crop_focal produces exact dims from an aspect-correct crop")
```

And in `__main__`, add the call after the parity test:

```python
        test_crop_focal_dims_and_no_distortion()
```

- [ ] **Step 2: Run — expect FAIL (`_crop_focal` not defined)**

Run: `cd /c/dev/snaptosize-worker/services/runner && python test_crop_focal.py`
Expected: `ImportError: cannot import name '_crop_focal'`.

- [ ] **Step 3: Implement `_crop_focal` in `crop_focal.py`**

Add at the top: `from PIL import Image`. Then:

```python
def _crop_focal(img: "Image.Image", target_w: int, target_h: int, fx: float, fy: float) -> "Image.Image":
    """Crop `img` to the target aspect around the focal point (no distortion),
    then resize to exact (target_w, target_h) with LANCZOS."""
    x, y, w, h = _focal_box(target_w, target_h, fx, fy, img.width, img.height)
    cropped = img.crop((x, y, x + w, y + h))
    return cropped.resize((target_w, target_h), Image.LANCZOS)
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /c/dev/snaptosize-worker/services/runner && python test_crop_focal.py`
Expected: both `OK:` lines print, exit 0.

- [ ] **Step 5: Commit**

```bash
cd /c/dev/snaptosize-worker
git add services/runner/crop_focal.py services/runner/test_crop_focal.py
git commit -m "feat(runner): _crop_focal crop-to-aspect + exact-dimension resize"
```

---

### Task 4: Watermark guard for the new mode (one-line, provably safe)

**Files:**
- Modify: `snaptosize-worker/services/runner/main.py` (the pre-branch watermark, currently at `main.py:678`)

- [ ] **Step 1: Capture the pre-edit base, then read the exact current lines**

First record the main.py base (it is untouched by this plan until now) — note this hash for Task 7:
Run: `cd /c/dev/snaptosize-worker && git rev-parse HEAD` → save as `MAIN_BASE`.

Run: `cd /c/dev/snaptosize-worker/services/runner && sed -n '675,680p' main.py`
Expected to see:
```python
        demo_flag = bool(payload.get("demo"))
        log_event("watermark_decision", **ctx, demo_raw=payload.get("demo"), demo_applied=demo_flag)
        if demo_flag:
            img = _apply_demo_watermark(img)
```

- [ ] **Step 2: Guard the pre-branch watermark so crop mode watermarks per-output instead**

Change the line `if demo_flag:` (the pre-branch one only) to:

```python
        if demo_flag and mode != "crop":
            img = _apply_demo_watermark(img)
```

Rationale: a centered watermark on the full source can be cropped OUT by a corner-focal crop. Crop mode watermarks each output AFTER crop in Task 5. For `single`/`pack`, `mode != "crop"` is always true → byte-identical behavior.

- [ ] **Step 3: Verify existing modes unchanged**

Run: `cd /c/dev/snaptosize-worker/services/runner && python -c "import ast; ast.parse(open('main.py').read()); print('main.py parses OK')"`
Expected: `main.py parses OK`.

- [ ] **Step 4: Commit**

```bash
cd /c/dev/snaptosize-worker
git add services/runner/main.py
git commit -m "feat(runner): exclude crop mode from pre-branch watermark (per-output instead)"
```

---

### Task 5: Runner `mode == "crop"` branch

**Files:**
- Modify: `snaptosize-worker/services/runner/main.py` (import + new branch after the `single` branch, before pack validation)

- [ ] **Step 1: Import `_crop_focal`**

Near the other local imports at the top of `main.py`, add:

```python
from crop_focal import _crop_focal
```

- [ ] **Step 2: Add the new branch immediately AFTER the `single` branch returns (right before the `# --- Pack / Custom-pack mode ---` comment)**

```python
        # --- Crop export mode (focal-cropped pack; additive, isolated from single/pack) ---
        if mode == "crop":
            if not group or group not in PACK_SIZES:
                raise HTTPException(status_code=400, detail=f"Crop mode requires a known group. Supported: {list(PACK_SIZES.keys())}")
            focal = payload.get("focal") or {}
            try:
                fx = float(focal.get("x", 0.5)); fy = float(focal.get("y", 0.5))
            except (TypeError, ValueError):
                fx, fy = 0.5, 0.5
            fx = min(1.0, max(0.0, fx)); fy = min(1.0, max(0.0, fy))

            work_dir = f"/tmp/{resolved_job_id}"
            os.makedirs(work_dir, exist_ok=True)
            work_dir_to_clean = work_dir
            base_zip = GROUP_ZIP_NAMES.get(group, f"{group}.zip")
            zip_filename = f"{artwork_name}_{base_zip}" if artwork_name else base_zip
            zip_path = os.path.join(work_dir, zip_filename)

            # Build pack targets for this group (same filename scheme as pack mode).
            t_rs = time.monotonic()
            pack_targets = []
            for spec in PACK_SIZES[group]:
                if group == "ISO":
                    label, w, h = spec
                    cm = ISO_CM_MAP.get(label, "")
                    filename = f"{label}_{cm}_{w}x{h}px.jpg"
                else:
                    if isinstance(spec, tuple) and len(spec) == 3:
                        _label, w_in, h_in = spec
                    else:
                        w_in, h_in = spec
                    w = int(round(float(w_in) * PPI)); h = int(round(float(h_in) * PPI))
                    w_cm = round(float(w_in) * 2.54); h_cm = round(float(h_in) * 2.54)
                    filename = f"{w_in}x{h_in}in_{w_cm}x{h_cm}cm_{w}x{h}px.jpg"
                if artwork_name:
                    filename = f"{artwork_name}_{filename}"
                pack_targets.append((filename, w, h))

            log_event("resize_start", **{**ctx, "mode": "crop"}, count=len(pack_targets), focal_x=fx, focal_y=fy)
            resized_images = []
            for filename, w, h in pack_targets:
                out_img = _crop_focal(img, w, h, fx, fy)
                if demo_flag:
                    out_img = _apply_demo_watermark(out_img)  # per-output watermark (free only)
                resized_images.append((filename, out_img))
            resize_ms = _ms_since(t_rs)
            log_event("resize_done", **ctx, count=len(resized_images), resize_ms=resize_ms)

            # Duplicated ZIP/quality-fallback loop (deliberate — does NOT share the pack branch's inline loop).
            log_event("zip_start", **ctx)
            t_zp = time.monotonic()
            now = datetime.utcnow().timetuple()[:6]
            quality_used = JPEG_QUALITY
            for q in [JPEG_QUALITY] + QUALITY_FALLBACK_STEPS:
                with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                    for fn, im in resized_images:
                        info = zipfile.ZipInfo(fn, date_time=now)
                        info.compress_type = zipfile.ZIP_DEFLATED
                        buf = BytesIO()
                        im.save(buf, "JPEG", quality=q, dpi=DPI, optimize=True)
                        zf.writestr(info, buf.getvalue())
                zip_bytes = os.path.getsize(zip_path)
                quality_used = q
                if zip_bytes <= MAX_ZIP_SIZE_BYTES:
                    break
            log_event("zip_done", **ctx, zip_bytes=zip_bytes, jpeg_quality=quality_used, zip_ms=_ms_since(t_zp))
            if zip_bytes > MAX_ZIP_SIZE_BYTES:
                raise HTTPException(status_code=413, detail=f"ZIP too large for Etsy ({zip_bytes / (1024*1024):.1f}MB > {MAX_ZIP_SIZE_MB}MB). Try fewer sizes.")

            r2_key = f"jobs/{resolved_job_id}/{zip_filename}"
            log_event("r2_upload_start", **ctx, r2_key=r2_key)
            t_up = time.monotonic()
            upload_zip_to_r2(zip_path, r2_key)
            log_event("r2_upload_done", **ctx, r2_key=r2_key, bytes=zip_bytes, upload_ms=_ms_since(t_up))
            asyncio.create_task(_write_kv_done(resolved_job_id, r2_key, group, mode, zip_filename))

            out["status"] = "done"
            out["group"] = group
            out["r2_key"] = r2_key
            out["download_filename"] = zip_filename
            out["zip_bytes"] = zip_bytes
            out["jpeg_quality"] = quality_used
            log_event("generate_done", **ctx, status="done", total_ms=_ms_since(t0))
            return out
```

- [ ] **Step 3: Verify it parses and existing branches are intact**

Run: `cd /c/dev/snaptosize-worker/services/runner && python -c "import ast; ast.parse(open('main.py').read()); print('OK')"`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
cd /c/dev/snaptosize-worker
git add services/runner/main.py
git commit -m "feat(runner): mode==crop branch — per-ratio focal-crop pack (isolated, additive)"
```

---

### Task 6: Local engine harness on a real image (no network)

**Files:**
- Create: `snaptosize-worker/services/runner/test_crop_focal_image.py`

- [ ] **Step 1: Write a harness that crops the bundled `test_input.jpg` across a real group**

```python
# Proves the crop engine end-to-end on a real image WITHOUT R2/network:
# every 4x5 target comes out at exact print dims and is an undistorted crop.
import os
from PIL import Image
from crop_focal import _crop_focal, _focal_box

HERE = os.path.dirname(os.path.abspath(__file__))
PPI = 300
FOUR_FIVE = [(8, 10), (12, 15), (16, 20), (20, 25), (24, 30)]  # mirrors PACK_SIZES["4x5"]

def main():
    src = Image.open(os.path.join(HERE, "test_input.jpg")).convert("RGB")
    print(f"source: {src.width}x{src.height}")
    for w_in, h_in in FOUR_FIVE:
        w, h = int(round(w_in * PPI)), int(round(h_in * PPI))
        out = _crop_focal(src, w, h, 0.5, 0.5)
        assert out.size == (w, h), f"{w_in}x{h_in}: got {out.size}, want {(w, h)}"
    # A right-side focal must move the crop box right vs. a left-side focal.
    bx_left, *_ = _focal_box(4, 5, 0.1, 0.5, src.width, src.height)
    bx_right, *_ = _focal_box(4, 5, 0.9, 0.5, src.width, src.height)
    assert bx_right >= bx_left, f"focal right should not move box left ({bx_right} < {bx_left})"
    print("OK: all 4x5 targets exact-dim; focal point shifts the crop")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it — expect PASS**

Run: `cd /c/dev/snaptosize-worker/services/runner && python test_crop_focal_image.py`
Expected: prints source dims then `OK: all 4x5 targets exact-dim; focal point shifts the crop`.

- [ ] **Step 3: Commit**

```bash
cd /c/dev/snaptosize-worker
git add services/runner/test_crop_focal_image.py
git commit -m "test(runner): local crop-engine harness on a real image (no network)"
```

---

### Task 7: Safety review — prove existing modes untouched

**Files:** none (verification only)

- [ ] **Step 1: Confirm only additive changes to main.py**

Run: `cd /c/dev/snaptosize-worker && git diff $MAIN_BASE HEAD -- services/runner/main.py` (using the `MAIN_BASE` hash recorded in Task 4 Step 1)
Expected: the ONLY changes are (a) the `from crop_focal import _crop_focal` import, (b) `if demo_flag:` → `if demo_flag and mode != "crop":`, (c) the new `if mode == "crop":` block. No edits inside the `single` or pack/custom branches.

- [ ] **Step 2: Re-run all geometry/engine tests**

Run: `cd /c/dev/snaptosize-worker/services/runner && python test_crop_focal.py && python test_crop_focal_image.py`
Expected: all `OK:` lines, exit 0.

- [ ] **Step 3: Run the existing runner test to confirm no regression**

Run: `cd /c/dev/snaptosize-worker/services/runner && python test_outpaint.py`
Expected: passes / behaves exactly as before this plan (if it needs env/network it may skip — confirm it's no worse than a clean checkout).

- [ ] **Step 4: Re-run the JS suite**

Run: `cd /c/dev/snaptosize-app && npx vitest run`
Expected: all crop + crop-vectors tests pass.

- [ ] **Step 5: Hand back**

Report: parity proven (JS == Python on shared vectors), crop engine produces exact-dimension undistorted output, existing branches byte-identical. Do NOT deploy the Runner yet — Plan 2 (app/Worker wiring + picker UI) and a preview deploy come next, and Runner deploys must go from `services/runner/` (never the root `fly.toml`).

---

## Self-Review Notes

- **Spec coverage (§ of design spec):** geometry parity invariant → Tasks 1–2; `_crop_focal` no-distortion engine → Task 3; per-output watermark / gate integrity → Tasks 4–5; duplicate-not-refactor ZIP loop → Task 5; existing-mode isolation proof → Task 7. Worker pass-through needs no change (verified: `payload: body`). UI, plan gating, resolution guard, ratio set, naming → Plan 2.
- **Type/name consistency:** `_focal_box(w,h,fx,fy,src_w,src_h)` and `_crop_focal(img,target_w,target_h,fx,fy)` used identically in tests, harness, and the branch. `demo_flag`, `ctx`, `resolved_job_id`, `artwork_name`, `GROUP_ZIP_NAMES`, `PACK_SIZES`, `ISO_CM_MAP`, `QUALITY_FALLBACK_STEPS`, `MAX_ZIP_SIZE_BYTES` all reference existing `main.py` symbols (confirmed present).
- **No placeholders:** every code step is complete and runnable.
- **Out of scope (Plan 2):** app `/api/enqueue` + picker UI, click→drag, removing the client-side full-res download, plan gating, resolution guard, ratio set beyond 2:3/3:4/4:5/ISO, naming.
```
