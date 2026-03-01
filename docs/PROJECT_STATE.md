# PROJECT_STATE.md  
## SnapToSize — Authoritative System State

Last updated: 2026-03-01

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

## Cloudflare Pages Constraint (App Router POST Limitation)

SnapToSize frontend runs on Cloudflare Pages (static prerender).

Constraint:
- POST requests to /app/* routes return 405 by default.
- Next.js Server Actions (including Clerk invalidateCacheAction) POST to current route.
- Middleware does NOT execute for prerendered static responses on Pages.

Workaround (Production):
- Server Action POSTs with `next-action` header are intercepted at edge level.
- Response: 200 with `content-type: text/x-component` and no-op RSC flight body.
- Prevents Clerk auth state changes from failing on static routes.

Important:
SnapToSize frontend assumes static hosting.
Server Actions must never be relied upon for critical functionality.

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

### Next.js App Events (Server-Side)

Next.js app emits events via server-side PostHog wrapper (`app/lib/posthog.ts`).

All use `distinct_id = clerk:{userId}` to match Worker format.

Events:

- **billing_view** — every billing page render
  - Properties: source, kind, success, canceled, plan_before
  - File: `app/api/analytics/billing-view/route.ts`

- **upgrade_clicked** — billing page opened with `?source=` param
  - Properties: source, kind, entry, plan_before
  - File: `app/api/analytics/billing-view/route.ts`

- **checkout_started** — Stripe checkout session created
  - Properties: interval, source, kind, plan_before
  - File: `app/api/stripe/checkout/route.ts`

- **checkout_completed** — Stripe webhook confirms payment
  - Properties: source, kind, interval, price_id, plan_after
  - File: `app/api/stripe/webhook/route.ts`

- **portal_opened** — Stripe billing portal opened
  - Properties: plan_before, entry
  - File: `app/api/stripe/portal/route.ts`

- **subscription_updated** — Stripe subscription status change
  - Properties: status, plan_after
  - File: `app/api/stripe/webhook/route.ts`

- **subscription_deleted** — Stripe subscription canceled
  - Properties: status, plan_after
  - File: `app/api/stripe/webhook/route.ts`

Attribution chain:
- Upgrade links pass `?source=` and `?kind=` to billing page
- Billing page forwards source/kind to checkout POST body
- Checkout route writes source/kind into Stripe session metadata
- Webhook reads session.metadata.source/kind into checkout_completed

Important implementation detail:
- All posthogCapture() calls MUST be awaited on Cloudflare Pages edge runtime.
- Without await, the edge worker terminates before the fetch completes and events are silently dropped.
- This applies to all route handlers using `export const runtime = "edge"`.

Verified live: 2026-03-01. All events confirmed in PostHog Activity.

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

- Subscription lifecycle UX polish (cancel_at_period_end display, portal clarity)
- Client-side funnel tracking on marketing site (landing → app click attribution)
- Growth content layer (SEO guides + landing pages)

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

## Immediate Next Steps

1. PostHog dashboard setup (manual)
   - Create "SnapToSize – Upgrade Attribution" dashboard in PostHog UI
   - Add funnel: upgrade_clicked → checkout_started → checkout_completed
   - Add trends: checkout_completed, upgrade_clicked, billing_view (daily by source)

2. Landing → App attribution (NOT YET BUILT)
   - Add UTM param capture on marketing site (snaptosize.com)
   - Pass UTM through to app signup flow
   - Track landing_click event with UTM properties

3. First export tracking (NOT YET BUILT)
   - Correlate Worker enqueue_success with user's first-ever export
   - Track first_export event with mode (pack/single)

4. Conversion architecture
   - Ensure clean separation:
     snaptosize.com → marketing
     app.snaptosize.com → product
   - No embedding of app inside marketing
   - Clear upgrade path

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

Core engine + billing + reliability + abuse protection + upgrade attribution tracking complete.

Clerk production instance live (clerk.snaptosize.com).
Stripe production checkout + portal + webhook verified.
PostHog growth funnel events verified live (2026-03-01).

# 13. Growth System (ACTIVE PHASE)

## 13.1 Ideal Customer Profile (Locked)

Primary ICP:
- Etsy sellers selling DIGITAL wall art / printables
- 10–200 listings OR consistent sales history
- Already earns > $500/mo (not beginners)
- Pain: resizing, packaging, naming, Etsy upload compliance

Secondary ICP:
- POD creators scaling listing count
- Bundle sellers needing consistent size sets

Not targeting (by default):
- Hobby/one-off Canva users
- Generic “image resizer” traffic
- People who don’t sell on Etsy

## 13.2 North Star Metric (Locked)

Primary:
- Weekly Pro activations (count)

Secondary:
- Free → Pro conversion rate
- Time-to-first-export (TTFE)
- Upgrade click rate after 402
- Job success rate (error %)

Targets (initial):
- Free → Pro conversion ≥ 7% (minimum viable)
- Free → Pro conversion ≥ 10% (goal)
- TTFE ≤ 60 seconds median
- Job success rate ≥ 99%

## 13.3 Funnel Definition (Tracked — LIVE)

Full upgrade funnel tracked in PostHog (verified 2026-03-01):

| Step | Event | Status |
|------|-------|--------|
| Billing page view | billing_view | LIVE |
| Upgrade click | upgrade_clicked | LIVE |
| Checkout started | checkout_started | LIVE |
| Checkout completed | checkout_completed | LIVE |
| Portal opened | portal_opened | LIVE |
| Subscription changed | subscription_updated | LIVE |
| Subscription canceled | subscription_deleted | LIVE |

Not yet tracked:
- Landing → App click (requires marketing site instrumentation)
- App → First export (requires Worker event correlation)

PostHog dashboard: "SnapToSize – Upgrade Attribution" (manual setup in PostHog UI).

Implementation rule:
- Every step is a PostHog event with consistent distinct_id (clerk:{userId}) + properties (source, kind, plan_before/plan_after).

## 13.4 Marketing Execution Channels (3 lanes)

Lane A — SEO content engine:
- Print size guides (ratios + exact Etsy sizes)
- “How to sell printables on Etsy” content
- Size/ratio calculators (lead capture)
- Long-tail keyword capture

Lane B — Etsy-native positioning:
- Messaging: “Built for Etsy sellers”
- Emphasize: exact ratios + naming + zip packs + no cropping + under 20MB compliance

Lane C — Direct niche distribution:
- Reddit: Etsy sellers subreddits
- Facebook groups (digital downloads / printables)
- Pinterest (printable audience)
- IndieHackers / build-in-public

## 13.5 Conversion Optimization (Planned experiments)

- Show free remaining counts (quick + packs)
- Inline upsell after 402 (one-click to billing)
- Watermark preview + “Remove watermark” CTA
- Annual plan highlight + anchor pricing
- Checkout abandonment tracking
- Exit-intent paywall on billing

## 13.6 Revenue Tracking (Stripe source of truth)

Track weekly:
- MRR
- Net revenue
- Pro activations
- Churn
- Annual vs monthly split

Milestone path:
- 10 paying users → validate willingness
- 100 paying users → validate retention + pricing
- 500 paying users → prove growth engine
- 1000+ paying users → scale distribution

---

## Next Major Build

Growth & Conversion Infrastructure

Focus shifts from backend stability to distribution and revenue optimization.

Scope:

- SEO content layer (Etsy guides, print size resources)
- Conversion copy optimization
- Pricing experiments
- ~~Upgrade funnel tracking (checkout_started → checkout_completed)~~ DONE (2026-03-01)
- Stripe lifecycle UX polish (portal clarity, cancellation flow)
- Revenue dashboard (MRR, Pro activation rate)

Backend engine is stable.
Now building growth engine.