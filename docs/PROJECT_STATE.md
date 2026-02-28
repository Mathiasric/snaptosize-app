# PROJECT_STATE.md  
## SnapToSize — Authoritative System State

Last updated: 2026-02-24

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

Cloudflare Pages now requires:
- WORKER_BASE_URL set in Production environment variables

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

---

## 3.1.1 Job Modes (Locked)

System supports multiple output modes via the same job pipeline:

- `mode = "pack"` (default)
  - Output: ZIP (application/zip)

- `mode = "single"` (LIVE)
  - Output: single JPG (image/jpeg)
  - User selects size + orientation
  - Landscape swaps dimensions

Single mode now:
- Runner: implemented
- Worker: implemented
- Frontend: implemented (Quick Export tab)
- Presigned filename respected
- Content-Disposition enforced

---

## 3.2 Naming Standard (Locked)

### Pack ZIP + Folder naming

ZIP filename:
- `<group>_print_sizes.zip`

Folder inside ZIP:
- `<group>_print_sizes/`
- No UUID paths

### Single export naming

Uses:
- `download_filename` from KV

Fallback:
- `export_<group>_<size>_<orientation>.jpg`

All downloads set Content-Disposition.

---

## 3.3 Stretch Policy (Strategic Choice)

Deliberate stretch resize.

Product differentiator.

---

## 3.4 20MB Etsy Limit Handling

ZIP size ≤ 20MB.

Fallback encoding chain preserved.

413 returned on hard fail.

---

## 3.5 Quick Export Mode (LIVE)

Square supported.

All orientations working.

Same quota system as pack mode.

---

## 3.6 Server-Side Analytics (LIVE)

PostHog server-side analytics implemented.

Worker emits events:

- enqueue_success
- job_done
- job_error
- download_clicked

Events are:
- Non-blocking (ctx.waitUntil)
- Fail-silent
- No PII (distinct_id = clerk:{userId} or ip:{ip})
- EU host default (https://eu.posthog.com)
- Requires POSTHOG_API_KEY secret in Worker

Analytics is production-safe and verified live.

# 4. Free vs Pro System (LIVE)

## 4.1 Free Plan

Enforced at Worker level.

Limits:
- Quick Export: 3/day
- Packs: 1/day

HTTP 402 responses:
- FREE_QUICK_LIMIT
- FREE_BATCH_LIMIT

KV key:
`quota:{userId}:{YYYY-MM-DD}`

TTL: 36h

Server-authoritative.

---

## 4.2 Stripe Integration (LIVE)

## 4.2 Stripe Integration (LIVE – HARDENED)

Stripe Checkout: implemented  
Stripe Customer Portal: implemented  
Stripe Webhook: implemented  
Clerk metadata sync: implemented  

Lifecycle hardening (2026-02-24):

Handled statuses:
- active → pro
- trialing → pro
- past_due → pro (grace period retained)
- canceled → free
- unpaid → free
- incomplete → free
- incomplete_expired → free

Webhook improvements:
- Idempotency guard (event.id deduplication per instance)
- Explicit error handling (returns 500 to trigger Stripe retry)
- Stripe remains source of truth
- Clerk mirrors subscription state

Plan propagation:
Stripe → Webhook → Clerk publicMetadata.plan → JWT → Worker enforcement

Worker fail-safe:
If plan unclear or missing → treated as free.

---

## 4.3 Demo Bypass (REMOVED – 2026-02-24)

Production demo bypass eliminated.

Changes:
- Worker no longer respects client-provided `demo` flag for quota bypass.
- Quota enforcement depends ONLY on plan (free/pro).
- Worker forcibly sets:
  - free → demo=true (watermark)
  - pro → demo=false
- `/app/test` page removed from frontend.

Result:
No production path exists to bypass quota without Stripe-backed Pro plan.

---

## 4.4 Abuse Protection (LIVE – 2026-02-24)

Worker-level abuse protection implemented.

Rate limits (per userId or ip fallback):
- POST /upload → 10 requests / 10 minutes
- POST /enqueue → 30 requests / 10 minutes

Active job caps (KV counter-based, O(1)):
- Free: 2 concurrent jobs
- Pro: 7 concurrent jobs

Implementation:
- KV key: active:{userId}
- TTL: 60 minutes (self-healing)
- active_counted flag prevents double-decrement
- 429 responses:
  - code: "rate_limited"
  - error: "too_many_active_jobs"

No API contract changes.
Quota system (402 FREE_*) unchanged.

# 5. Frontend Status

## 5.1 Production UI

- Packs working
- Quick Export working
- Billing page working
- 402 paywall UX implemented
- Pro badge visible
- Yearly discount badge (33%)

---

## 5.2 Debug Page

Still present for internal use.

Not public UX.

---

# 6. Worker API (Immutable Contract)

POST /upload  
POST /enqueue  
GET /status/:job_id  
GET /download/:job_id  
POST /upload-zip  

Contract unchanged.

---

# 7. What Is Considered Stable

- Infrastructure
- ZIP generation
- Quick Export
- Naming
- 20MB enforcement
- Stripe checkout
- Webhook sync
- Pro gating
- Proxy architecture
- Abuse protection (rate limits + active job caps)
- Abuse protection (rate limiting + O(1) active job caps) 
- Server-side analytics (PostHog)        

Core + monetization + protection base working.

---

# 8. What Is NOT Built Yet

- Subscription lifecycle UX polish (cancel_at_period_end display)
- Analytics

---

# 8.1 Production Reliability Layer (LIVE – PRODUCTION)
Reliability system is fully implemented and deployed.

System is:

Self-healing

KV-backed

Cron-monitored

Push-alert enabled

Layer 1: Persistent Job State (LIVE)

KV key:

job:{job_id}

State includes:

status

retry_count

error_code

error_message

runner_status

r2_key

updated_at

alert_sent

KV updated on:

enqueue start

runner_call start

retry increment

runner failure

process_done

timeout

job_id is authoritative operational key.

Layer 2: Auto-Heal (LIVE)

Worker retries runner up to 3 times on:

network error

5xx

timeout

Exponential backoff.

After 3 failures:

status = error

error_code = "runner_failed"

alert triggered

Layer 3: Stuck Job Detection (LIVE)

Cloudflare Cron Trigger:

*/5 * * * *

Every 5 minutes:

Scan KV prefix job:

If status == running AND updated_at older than 10 min:

Mark error

error_code = "timeout"

Send alert

Pagination implemented.
Milliseconds consistent.
No manual monitoring required.

Layer 4: Mobile Alerting (LIVE)

Alert channel: Pushover

Trigger conditions:

runner failed after retries

stuck job detected

job transitions to error

Alert contains:

job_id

error_code

group

mode

alert_sent flag prevents duplicate alerts.

System is production-safe without live supervision.

---

## Layer 1: Persistent Job State (KV-backed)

Each job_id becomes the single source of truth.

KV key:
job:{job_id}

Value structure:
{
  status: "running" | "done" | "error",
  retry_count: number,
  error_code?: string,
  error_message?: string,
  runner_status?: number,
  r2_key?: string,
  updated_at: timestamp
}

Worker must update KV at:
- enqueue start
- runner_call start
- runner_call fail
- retry increment
- process_done
- error
- timeout

job_id becomes primary operational debug key.

request_id remains correlation key.

---

## Layer 2: Auto-Heal (Retry Logic)

Worker must:

- Retry runner_call up to 3 times on:
  - network error
  - 5xx
  - timeout

- Exponential backoff

After 3 failures:
  status = error
  error_code = "runner_failed"

System should attempt self-recovery before alerting.

---

## Layer 3: Stuck Job Detection (Cron)

Cloudflare Cron Trigger (every 5 minutes):

- Scan KV
- Find jobs:
    status = running
    updated_at older than 10 minutes

- Mark:
    status = error
    error_code = "timeout"

- Trigger alert

---

## Layer 4: Mobile Alerting

Alert channel: Pushover

Worker sends push notification when:
- job transitions to error
- stuck job detected
- runner repeatedly fails

Alert includes:
- job_id
- error_code
- group
- mode

Goal:
Phone notification within 1–5 minutes of production failure.

---

## Layer 5: Debug Ergonomics

Future additions:
- CLI script: fetch job state + worker logs + runner logs by job_id
- UI button: "Copy debug info"

job_id is operational case number.

---

After this layer is implemented:

SnapToSize becomes:
- Self-healing
- Self-monitoring
- Push-alert enabled
- Production-safe without live supervision

# 9. Strategic Positioning

SnapToSize = Etsy-native print pack generator.

Differentiators unchanged.

---

# 10. Next Phase Roadmap

## Immediate Next Step

1. Marketing layer upgrade (snaptosize.com redesign)
   - Align visual identity with app.snaptosize.com
   - Clean premium SaaS design (minimal, structured, confident)
   - Add real product screenshots / flow visuals
   - Clear positioning: Etsy-native print pack generator
   - Strong CTA: Start free → app.snaptosize.com
   - Structured pricing section
   - FAQ addressing Etsy sellers’ real concerns

2. Conversion architecture
   - Ensure clean separation:
     snaptosize.com → marketing
     app.snaptosize.com → product
   - No embedding of app inside marketing
   - Clear upgrade path

3. Core funnel dashboard in PostHog
   - Funnel: enqueue_success → job_done → download_clicked
   - Breakdown by plan and mode
   - Monitor job_error rate

## Phase 3: Hardening

- Abuse prevention
- Concurrency caps
- Logging
- Monitoring
- Production alerting
- Remove debug endpoints

---

# 11. Important Rules Going Forward

- No Worker contract breakage.
- Stripe is subscription authority.
- Clerk mirrors state.
- No architecture drift.
- No client-side plan trust.
- Remove demo bypass before scale.

---

# 12. Current System Status

Core engine + billing + reliability + abuse protection complete.

## Next Major Build

Growth & Conversion Infrastructure

Focus shifts from backend stability to distribution and revenue optimization.

Scope:

- SEO content layer (Etsy guides, print size resources)
- Conversion copy optimization
- Pricing experiments
- Upgrade funnel tracking (checkout_started → checkout_completed)
- Stripe lifecycle UX polish (portal clarity, cancellation flow)
- Revenue dashboard (MRR, Pro activation rate)

Backend engine is stable.
Now building growth engine.