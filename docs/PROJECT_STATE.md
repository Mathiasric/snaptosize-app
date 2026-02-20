# PROJECT_STATE.md  
## SnapToSize — Authoritative System State

Last updated: 2026-02-18

---

# 1. Product Overview

SnapToSize is a SaaS tool for Etsy sellers.

Core promise:

> Upload one high-resolution image → receive ready-to-sell print size ZIP packs.

System runs full SaaS architecture:

Browser  
→ Next.js (Proxy + Clerk auth)  
→ Cloudflare Worker  
→ R2 storage  
→ Runner (Fly.io compute)  
→ R2  
→ Worker  
→ Next Proxy  
→ Browser  

Frontend never talks directly to Worker or R2.

---

# 2. Infrastructure

## Domains

Marketing:
- https://snaptosize.com

App:
- https://app.snaptosize.com

Worker:
- https://worker.snaptosize-mathias.workers.dev  
(Future: api.snaptosize.com)

Runner:
- Fly.io app (services/runner)

Storage:
- Cloudflare R2 bucket: `snaptosize-zips`

---

# 3. Backend Status (PRODUCTION READY)

## 3.1 Etsy Pack System

Five production Etsy ZIP packs:

1. 2x3_ratio.zip  
2. 3x4_ratio.zip  
3. 4x5_ratio.zip  
4. ISO_A_series.zip  
5. Common_sizes.zip 
+1. 2x3_print_sizes.zip  
+2. 3x4_print_sizes.zip  
+3. 4x5_print_sizes.zip  
+4. iso_print_sizes.zip  
+5. extras_print_sizes.zip   

Each pack:
- 300 DPI
- JPEG
- Lanczos resize
- Stretch-only (NO cropping)
- Auto-rotated via EXIF
- 20MB Etsy hard limit enforced
- Quality fallback: 80 → 76 → 72 → 68 → 64 → 60

+## 3.1.1 Job Modes (Locked)
+
+System supports multiple output modes via the same job pipeline (Next → Worker → Runner → R2):
+
+- `mode = "pack"` (default)
+  - Output: ZIP (application/zip)
+  - Contains multiple JPG files in a single top-level folder per group.
+
+- `mode = "single"` (in progress)
+  - Output: single JPG (image/jpeg)
+  - User selects one size within a group + orientation (Portrait/Landscape).
+  - Landscape = swapped dimensions (same ratio group, rotated target).
+
+This avoids adding parallel pipelines and keeps KV/R2/presign consistent.
+
+---
+

---

## 3.2 Naming Standard (Locked)

### Inch-based packs (2x3 / 3x4 / 4x5 / EXTRAS)

Format:


Structure:

- Inches
- Centimeters (rounded properly)
- Pixel dimensions

+### Pack ZIP + Folder naming
+
+- ZIP filename (customer-facing): `<group>_print_sizes.zip`
+  - `2x3_print_sizes.zip`, `3x4_print_sizes.zip`, `4x5_print_sizes.zip`
+  - `iso_print_sizes.zip`, `extras_print_sizes.zip`
+
+- Folder inside ZIP (top-level): `<group>_print_sizes/`
+  - No UUIDs. No internal paths.
---

### ISO Pack
+### Single export naming (customer-facing)
Format:


Structure:

- ISO label
- Exact cm
- Pixel dimensions
+Single JPG download uses `download_filename` (stored in KV when done).
+Fallback format if missing:
+
+- `export_<group>_<size>_<orientation>.jpg`

No inches used for ISO.
+All downloads must set Content-Disposition to match customer-facing filename (presigned `response-content-disposition`).
---

## 3.3 Stretch Policy (Strategic Choice)

We deliberately use stretch resize instead of crop.

Reason:
- Etsy sellers prefer zero-content-loss.
- Cropping removes important artwork details.
- Stretch difference visually negligible at print scale.

This is a product differentiator.

---

## 3.4 20MB Etsy Limit Handling

ZIP size must be ≤ 20MB.

Logic:
- Pre-resize images once
- Retry JPEG encoding at lower quality if needed
- Hard fail at quality 60 if still >20MB

System returns 413 if limit exceeded.

+## 3.5 Single Export Mode (Quick Export) — In Progress
+
+Goal:
+- Let users export ONE print size (not a full ZIP pack), using the same group catalogs.
+
+Input (job payload):
+- `mode: "single"`
+- `group: "2x3" | "3x4" | "4x5" | "ISO" | "EXTRAS"`
+- `size`: one size identifier within the group (e.g. `12x16`, `A4`, `8.5x11`)
+- `orientation: "Portrait" | "Landscape"` (Landscape swaps target dimensions)
+
+Output:
+- Single JPG uploaded to R2
+- Worker generates presigned download URL
+- Filename comes from `download_filename` stored in KV state
+
+Status:
+- Runner: implemented (early-return branch for `mode=="single"`, pack logic unchanged)
+- Worker: pending (KV fields + presign filename + content-type)
+- Frontend: pending (Quick Export UI tab + size picker)
+

Square support (Quick Export only):
- Orientation supports: Portrait | Landscape | Square
- Square uses group = "SQUARE"
- Supported square sizes (300 DPI):
  - 8x8  -> 2400x2400
  - 10x10 -> 3000x3000
  - 12x12 -> 3600x3600
  - 16x16 -> 4800x4800
  - 20x20 -> 6000x6000
  - 24x24 -> 7200x7200
- Output: single JPG (image/jpeg) with `download_filename` stored in KV
- Pack-mode remains untouched
+---
+
---

# 4. Free vs Pro System (Current State)

## 4.1 Free Plan

UPDATE (Model B — Separate counters):

Free Plan limits (enforced at Worker /enqueue):
- Quick Export (mode="single"): 3 exports/day
- Packs (mode="pack" or missing): 1 ZIP/day

Implementation details:
- KV key: `quota:${userId}:${YYYY-MM-DD}`
- Value: `{ "quick": number, "batch": number }`
- TTL: 36 hours
- Enforcement returns HTTP 402 with JSON:
  - `{ error: "FREE_QUICK_LIMIT", message, retry_after_sec }`
  - `{ error: "FREE_BATCH_LIMIT", message, retry_after_sec }`

UserId source:
- Authenticated: `clerk:{JWT sub}` (Clerk user id)
- Unauthenticated fallback: `ip:{client IP}`

Pro bypass:
- If plan resolves to `"pro"` (JWT claim variants), quota block is skipped.

NOTE:
- Demo bypass still exists for internal testing (`demo: true`), but should be removed before public monetization launch.


 

---

## 4.2 Temporary Demo Bypass (Development Only)

Worker logic currently:


If `demo: true` is sent in enqueue payload:
- Skips quota
- Does NOT decrement usage
- For internal testing only

This must be removed before production monetization phase.

---

## 4.3 Current Plan Model

There is no real Pro plan yet.

We have:
- Clerk auth working
- Free quota logic working
- No Stripe integration
- No subscription validation
- No server-side plan lookup yet

Pro logic not implemented.

---
# Phase 4 – JWT Plan Enforcement (Clerk → Worker)

## Auth Status

### Clerk
- Auth fully implemented
- Test user updated:
  - `publicMetadata.plan = "pro"`
- JWT template created:
  - Name: `snap`
- Custom claim configured in template:

```json
{
  "plan": "{{user.public_metadata.plan}}"
}


# 5. Frontend Status

## 5.1 Production UI

Location:
 
Features:
- Single upload
- Multi-pack selection
- Select all / Deselect all
- One enqueue per pack
- Single polling loop
- Individual job tracking
- Individual download buttons
- Uses proxy-only API routes
- Clean minimal dark UI

Quick Export (Single) UI:
- Separate page from Packs
- Orientation toggle: Portrait / Landscape / Square
- Square hides ratio groups and shows square size dropdown
- Micro preview + click-to-zoom implemented
- Debug UI should be hidden in production builds (dev may show)
---

## 5.2 Debug Page

Location:
 
Purpose:
- E2E debugging
- Manual group testing
- Demo bypass testing

Not part of product UX.

---

# 6. Worker API (Immutable Contract)

Endpoints:

POST /upload  
POST /enqueue  
GET /status/:job_id  
GET /download/:job_id  
POST /upload-zip (internal)

No changes allowed without versioning.

---

# 7. What Is Considered Stable

- Infrastructure
- ZIP generation
- Naming
- Etsy pack structure
- 20MB enforcement
- Proxy architecture
- Multi-pack UI
- R2 upload flow

Core product works end-to-end.

---

# 8. What Is NOT Built Yet

- Stripe billing
- Subscription management
- Plan storage in DB
- Pro verification
- Rate limiting beyond daily free
- Analytics
- Production domain cutover
- Removal of demo bypass
- Marketing automation

---

# 9. Strategic Positioning

SnapToSize = Etsy-native print pack generator.

Differentiators:

- Stretch instead of crop
- Fully Etsy-structured ZIP packs
- Proper cm + inch labeling
- 20MB aware system
- Batch generation for all major ratios

Goal:
Become default backend tool for Etsy digital print sellers.

---

# 10. Next Phase Roadmap

UPDATE (immediate next steps):

Next steps (in order):
1) Frontend paywall UX for quota (handle HTTP 402):
   - Show Upgrade card for FREE_QUICK_LIMIT / FREE_BATCH_LIMIT
   - Disable relevant action buttons (Export / Generate)
2) Stripe subscriptions (Checkout + Portal)
3) Webhook updates Clerk plan metadata → JWT claim
4) Worker plan enforcement becomes fully production-authoritative (Pro unlimited)
5) Remove demo bypass before launch

---

## Phase 3: Hardening

- Abuse prevention
- Concurrency caps
- Logging
- Monitoring
- Production alerting
- Remove debug endpoints

---

# 11. Next Chat Context Template

Start next chat with:


---

# 12. Important Rules Going Forward

- No breaking Worker contract.
- No direct browser → Worker calls.
- No local file generation.
- No architectural redesign.
- Monetization must be server-authoritative.
- Remove demo bypass before public launch.

---

# 13. Current System Status

System is:

Technically production-ready  
Monetization-incomplete  
Architecturally sound  
Scalable to high volume  

Core engine is done.

Next step = business layer.
