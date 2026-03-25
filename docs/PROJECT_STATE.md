# PROJECT_STATE.md
## SnapToSize — Technical System State

Last updated: 2026-03-25

> This file is the authoritative source for infrastructure, backend, API contracts, billing implementation, and monitoring.
> For business strategy, ICP, funnel, and growth execution, see GROWTH_STATE.md.

---

# 1. Product Overview

SnapToSize is a SaaS tool for Etsy sellers.

Core promise:
> Upload one high-resolution image → receive ready-to-sell print size ZIP packs.

System architecture:

```
Browser
→ Next.js (Proxy + Clerk auth)
→ Cloudflare Worker
→ R2 storage
→ Runner (Fly.io compute)
→ R2
→ Worker
→ Next Proxy
→ Browser
```

Frontend never talks directly to Worker or R2.

---

# 1.5 Repository Structure

Three separate repos. Each has a distinct responsibility.

## snaptosize-website
Marketing site: snaptosize.com
- Next.js static export (output: "out")
- Deployed to Cloudflare Pages
- Root directory: app-next/
- Contains: landing page, SEO pages, pricing, FAQ, EmailCapture component
- API routes do NOT work (static export) — use Worker for any server logic
- EmailCapture calls Worker directly for subscribe
- `images: { unoptimized: true }` — Cloudflare Pages constraint, do not change
- Hero background: `<picture>` with WebP primary + PNG fallback (see §15)
- OG images: Generated via Playwright MCP CLI screenshots (see §16)

## snaptosize-app  
Frontend app: app.snaptosize.com
- Next.js on Cloudflare Pages
- Contains: /app/packs, /app/quick-export, billing, Clerk auth
- Communicates with Worker via Next.js proxy
- Never talks directly to Worker or R2 from client

## snaptosize-worker (services/worker)
Backend + API: worker.snaptosize-mathias.workers.dev
- Cloudflare Worker
- Single source of truth for: quota enforcement, plan gating, job processing
- Handles: /upload, /enqueue, /status, /download, /upload-zip
- Planned: /subscribe (email capture — see §9.5)
- Contains: Stripe webhook, Resend email, PostHog analytics, abuse protection
- All secrets live here (RESEND_API_KEY, RESEND_AUDIENCE_ID, CLERK_JWKS_URL etc.)

## Rule
If it requires server-side logic → it belongs in the Worker.
Marketing site is static only.
App frontend proxies through Next.js to Worker.

---

# 2. Infrastructure

## Domains

| Purpose | URL |
|---------|-----|
| Marketing | https://snaptosize.com |
| App | https://app.snaptosize.com |
| Worker | https://worker.snaptosize-mathias.workers.dev (future: api.snaptosize.com) |

Runner: Fly.io app (services/runner)
Storage: Cloudflare R2 bucket `snaptosize-zips`
Cloudflare Workers Paid plan ($5/mnd) — activated 2026-03-03

Cloudflare Pages requires:
- `WORKER_BASE_URL` set in Production environment variables

---

## Cloudflare Pages Constraint (App Router POST Limitation)

SnapToSize frontend runs on Cloudflare Pages (static prerender).

**Constraint:**
- POST requests to /app/* routes return 405 by default
- Next.js Server Actions (including Clerk invalidateCacheAction) POST to current route
- Middleware does NOT execute for prerendered static responses on Pages

**Workaround (Production):**
- Server Action POSTs with `next-action` header are intercepted at edge level
- Response: 200 with `content-type: text/x-component` and no-op RSC flight body
- Prevents Clerk auth state changes from failing on static routes

**Rule:** Server Actions must never be relied upon for critical functionality.

---

# 3. Backend

## 3.1 Etsy Pack System

Five production Etsy ZIP packs:

| Pack | Filename |
|------|----------|
| 2:3 ratio | 2x3_print_sizes.zip |
| 3:4 ratio | 3x4_print_sizes.zip |
| 4:5 ratio | 4x5_print_sizes.zip |
| ISO A-series | iso_print_sizes.zip |
| Common sizes | extras_print_sizes.zip |

Each pack:
- 300 DPI
- JPEG
- Lanczos resize
- Stretch-only (NO cropping) — deliberate product differentiator
- Auto-rotated via EXIF
- 20MB Etsy hard limit enforced
- Quality fallback: 80 → 76 → 72 → 68 → 64 → 60

---

## 3.2 Job Modes (Locked)

**`mode = "pack"` (default)**
- Output: ZIP (application/zip)

**`mode = "single"` (LIVE)**
- Output: single JPG (image/jpeg)
- User selects size + orientation
- Landscape swaps dimensions
- Runner, Worker, Frontend: all implemented

---

## 3.3 Naming Standard (Locked)

**Pack ZIP + Folder:**
- ZIP filename: `<group>_print_sizes.zip`
- Folder inside ZIP: `<group>_print_sizes/`
- No UUID paths

**Single export:**
- Uses `download_filename` from KV
- Fallback: `export_<group>_<size>_<orientation>.jpg`
- All downloads set Content-Disposition

---

## 3.4 20MB Etsy Limit Handling

ZIP size ≤ 20MB enforced.
Fallback encoding chain preserved.
413 returned on hard fail.

---

# 4. Free vs Pro System (LIVE)

## 4.1 Free Plan Limits

Enforced at Worker level. Server-authoritative.

| Feature | Limit |
|---------|-------|
| Quick Export | 5/day |
| Packs | 2/day |

HTTP 402 responses:
- `FREE_QUICK_LIMIT` — includes `used`, `limit` fields
- `FREE_BATCH_LIMIT` — includes `used`, `limit` fields

Success responses (free users only):
- `remaining: { quick: N, batch: N }` — shows remaining exports for the day

Frontend displays remaining count when critical:
- Packs: badge when `remaining.batch <= 5`, over-selection warning when selected packs > remaining
- Singles: badge when `remaining.quick <= 2`

KV key: `quota:{userId}:{YYYY-MM-DD}` — TTL: 36h

---

## 4.2 Stripe Integration (LIVE — HARDENED)

Stripe Checkout, Customer Portal, Webhook, and Clerk metadata sync: all implemented.

**Lifecycle hardening (2026-02-24):**

| Stripe status | Plan |
|---------------|------|
| active | pro |
| trialing | pro |
| past_due | pro (grace period) |
| canceled | free |
| unpaid | free |
| incomplete | free |
| incomplete_expired | free |

**Webhook improvements:**
- Idempotency guard (event.id deduplication per instance)
- Explicit error handling (returns 500 to trigger Stripe retry)
- Stripe is source of truth; Clerk mirrors state

**Plan propagation:**
```
Stripe → Webhook → Clerk publicMetadata.plan → JWT (template: "snap") → Worker enforcement
```

JWT template "snap":
```json
{ "plan": "{{user.public_metadata.plan}}" }
```

**Worker secrets (must match production Clerk instance):**
- `CLERK_JWKS_URL` = https://clerk.snaptosize.com/.well-known/jwks.json
- `CLERK_ISSUER` = https://clerk.snaptosize.com

**Critical:** If Clerk instance changes, these secrets MUST be updated or all users resolve as "free".
Bug fixed 2026-03-03: CLERK_JWKS_URL pointed to old dev instance after Clerk production migration. Root cause: kid mismatch.

Worker fail-safe: If plan unclear or missing → treated as free.

---

## 4.3 Demo Bypass (REMOVED — 2026-02-24)

Production demo bypass eliminated.
- Worker no longer respects client-provided `demo` flag
- Quota enforcement depends ONLY on plan (free/pro)
- Worker forcibly sets: free → demo=true (watermark), pro → demo=false
- `/app/test` page removed

No production path exists to bypass quota without Stripe-backed Pro plan.

---

## 4.4 Abuse Protection (LIVE — 2026-02-24)

Worker-level abuse protection:

**Rate limits (per userId or ip fallback):**
- POST /upload → 10 requests / 10 minutes
- POST /enqueue → 30 requests / 10 minutes

**Active job caps (KV counter-based, O(1)):**
- Free: 2 concurrent jobs
- Pro: 7 concurrent jobs

Implementation:
- KV key: `active:{userId}` — TTL: 60 minutes (self-healing)
- `active_counted` flag prevents double-decrement
- 429 responses: `code: "rate_limited"` or `error: "too_many_active_jobs"`

---

# 5. Frontend

## 5.1 Production UI (LIVE)

- Packs: working
- Quick Export: working
  - Landscape orientation labels swap correctly (e.g., "8x10" → "10x8")
  - Remaining exports badge (batch ≤ 5 with over-selection warning, quick ≤ 2)
- Download error redirects: `/api/download` redirects back to originating page with `?download_error={code}` on Worker errors (open-redirect protected via `/app/` prefix validation)
- Billing page: working (redesigned with Free vs Pro comparison table, social proof)
- 402 paywall UX: implemented
- Pro badge: visible
- Yearly discount badge: 33%
- Onboarding guide: always visible on both pages (not dismissible)
- Watermark notice: free users see "Free: includes watermark · Remove" text on uploaded preview (links to billing)
- Size request: inline form ("Missing a size?") on both pages → PostHog event + email notification
- JobCard micro-interactions: slide-in animation + success-pop on completion
- Size catalog: 5x5 square and 13x19 fine art added (2026-03-23)

## 5.2 Debug Page

Present for internal use only. Not public UX.

---

# 6. Worker API (Immutable Contract)

```
POST /upload
POST /enqueue
GET  /status/:job_id
GET  /download/:job_id
POST /upload-zip
```

**Contract is immutable.** Do not modify endpoints, response shapes, or auth flow without explicit instruction.

---

# 7. What Is Stable (Do Not Touch)

- Infrastructure and proxy architecture
- ZIP generation and naming
- Quick Export (landscape label swapping)
- 20MB enforcement
- Stripe checkout + webhook sync
- Pro gating and quota enforcement
- Abuse protection (rate limiting + O(1) active job caps)
- Server-side analytics (PostHog)
- JWT/Clerk production auth (verified 2026-03-03)
- Cloudflare Workers Paid plan
- Multi-channel alerting (Pushover + Email + PostHog + Sentry)

---

# 8. Production Reliability Layer (LIVE)

System is: self-healing, KV-backed, cron-monitored, push-alert enabled.

## Layer 1: Persistent Job State

KV key: `job:{job_id}`

```json
{
  "status": "running | done | error",
  "retry_count": 0,
  "error_code": "string (optional)",
  "error_message": "string (optional)",
  "runner_status": 200,
  "r2_key": "string (optional)",
  "updated_at": "timestamp",
  "alert_sent": false
}
```

KV updated on: enqueue start, runner_call start, runner_call fail, retry increment, process_done, error, timeout.

`job_id` = primary operational debug key.
`request_id` = correlation key.

**Legacy dual KV write (LOW priority debt):**
- `updateJobState` writes to both `job:{id}` (new) and `{id}` (legacy)
- Frontend currently reads `{id}` via /status endpoint
- When frontend migrates to `job:{id}`, remove legacy write to halve KV writes

## Layer 2: Auto-Heal (Retry Logic)

Worker retries runner_call up to 3 times on: network error, 5xx, timeout.
Exponential backoff.
After 3 failures: status = error, error_code = "runner_failed", alert triggered.

## Layer 3: Stuck Job Detection (Cron)

Cloudflare Cron: `*/5 * * * *`

Every 5 minutes:
- Scan KV prefix `job:`
- If status == running AND updated_at > 10 min ago → mark error, error_code = "timeout", send alert

Optimization: KV metadata (status + updated_at) stored on job: keys.
Cron uses metadata from list() — O(stuck jobs only), not O(all jobs).
Pagination implemented.

## Layer 4: Mobile Alerting

Channel: Pushover

Triggers: runner failed after retries, stuck job detected, job transitions to error.
Alert contains: job_id, error_code, group, mode.
`alert_sent` flag prevents duplicates.

## Layer 5: Debug Ergonomics (Future)

- CLI script: fetch job state + worker logs + runner logs by job_id
- UI button: "Copy debug info"

---

# 9. Analytics — Server-Side (LIVE) + Marketing Site (LIVE)

## Worker Events

| Event | Trigger |
|-------|---------|
| enqueue_success | Job enqueued |
| job_done | Job completed |
| job_error | Job failed |
| download_clicked | Download initiated |

Properties: non-blocking (ctx.waitUntil), fail-silent, no PII.
Distinct ID: `clerk:{userId}` or `ip:{ip}`
EU host: https://eu.posthog.com
Requires: `POSTHOG_API_KEY` secret in Worker.

## Next.js App Events

All use `distinct_id = clerk:{userId}`.

| Event | File | Properties |
|-------|------|------------|
| billing_view | app/api/analytics/billing-view/route.ts | source, kind, success, canceled, plan_before |
| upgrade_clicked | app/api/analytics/billing-view/route.ts | source, kind, entry, plan_before |
| checkout_started | app/api/stripe/checkout/route.ts | interval, source, kind, plan_before |
| checkout_completed | app/api/stripe/webhook/route.ts | source, kind, interval, price_id, plan_after |
| portal_opened | app/api/stripe/portal/route.ts | plan_before, entry |
| subscription_updated | app/api/stripe/webhook/route.ts | status, plan_after |
| subscription_deleted | app/api/stripe/webhook/route.ts | status, plan_after |
| size_requested | app/api/size-request/route.ts | size, page, user_email, plan |

**Critical:** All `posthogCapture()` calls MUST be awaited on Cloudflare Pages edge runtime. Without await, edge worker terminates before fetch completes and events are silently dropped. Applies to all route handlers using `export const runtime = "edge"`.

## Pattern Tracking Events

| Event | Distinct ID | Properties |
|-------|-------------|------------|
| jwt_verification_failed | "system" | error, jwks_url |
| rate_limit_hit | userId | route, limit, plan |
| active_job_cap_hit | userId | plan, active, max |

---

# 9.5 Email List & Lead Capture (PLANNED)

## Overview

Email capture system for marketing site lead generation using Resend Audience.

**Status:** Specification complete, not yet implemented.

**Purpose:** Capture leads from marketing site, deliver lead magnet (PDF), nurture via 3-email sequence.

---

## Worker API Endpoint

### POST /subscribe

**Purpose:** Add email to Resend Audience and trigger welcome sequence.

**Authentication:** Public endpoint (no auth required).

**Rate limiting:** 10 requests / 10 minutes per IP (prevent spam).

**Request:**
```json
{
  "email": "seller@example.com",
  "source": "hero" | "exit_intent" | "etsy_print_sizes"
}
```

**Validation:**
- Email format validation (RFC 5322)
- Source must be one of allowed values

**Response (success - 200):**
```json
{
  "success": true,
  "contact_id": "resend_contact_abc123"
}
```

**Response (validation error - 400):**
```json
{
  "success": false,
  "error": "Invalid email format"
}
```

**Response (rate limit - 429):**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Try again later."
}
```

**Response (server error - 500):**
```json
{
  "success": false,
  "error": "Failed to subscribe. Please try again."
}
```

---

## Resend Integration

### Audience Configuration

**Resend Audience ID:** Stored in `RESEND_AUDIENCE_ID` (Worker secret).

**Audience Name:** "SnapToSize Email List"

**API endpoint:** `https://api.resend.com/audiences/{audience_id}/contacts`

**Method:** POST

**Headers:**
```
Authorization: Bearer {RESEND_API_KEY}
Content-Type: application/json
```

**Body:**
```json
{
  "email": "seller@example.com",
  "unsubscribed": false,
  "first_name": null,
  "last_name": null
}
```

### Error Handling

**Duplicate email:**
- Resend returns 400 with "Contact already exists"
- **Worker behavior:** Return success (silent, no user-facing error)
- Rationale: User shouldn't see error for re-subscribing

**Invalid email:**
- Resend returns 400 with validation error
- **Worker behavior:** Return 400 to client with "Invalid email format"

**Resend API failure (5xx, timeout):**
- **Worker behavior:** Log error, send Pushover alert, return 500 to client
- Alert message: "SnapToSize Email Capture Error — Resend API failure"

---

## Automated Email Sequence

All emails configured in Resend dashboard with automated triggers.

### Email 1: Welcome + PDF (Immediate)

**Trigger:** Contact added to Resend Audience

**From:** alerts@snaptosize.com

**Subject:** "Your Free Etsy Print Size Cheat Sheet"

**Template ID:** `welcome-pdf-delivery` (created in Resend)

**Attachment:**
- Filename: `etsy-print-size-cheat-sheet.pdf`
- Hosted: `https://snaptosize.com/assets/etsy-print-size-cheat-sheet.pdf`
- Delivery: Resend attachment

**Content:**
- Welcome message
- Brief intro to SnapToSize
- PDF download link (fallback if attachment fails)
- Unsubscribe link (Resend automatic)

---

### Email 2: Sizing Mistakes Guide (Day 3)

**Trigger:** 3 days after Email 1

**From:** alerts@snaptosize.com

**Subject:** "6 Common Etsy Print Sizing Mistakes (and how to avoid them)"

**Template ID:** `sizing-mistakes-guide`

**Content:**
- List of 6 common mistakes
- Solutions for each
- Soft CTA: Link to /etsy-print-sizes
- Unsubscribe link

---

### Email 3: Product CTA (Day 7)

**Trigger:** 7 days after Email 1

**From:** alerts@snaptosize.com

**Subject:** "Stop spending 3 hours per listing"

**Template ID:** `product-cta`

**Content:**
- Problem: Manual resizing takes 1–3 hours per listing
- Solution: SnapToSize automates the entire workflow
- Social proof: "Over 18,000 size packs generated"
- **CTA:** "Start Free" → https://app.snaptosize.com
- Unsubscribe link

---

## Analytics & Tracking

### PostHog Events

**Worker events (POST /subscribe):**

| Event | Trigger | Properties |
|-------|---------|------------|
| `email_capture_attempted` | /subscribe called | `source`, `email_hash` (SHA256 for privacy) |
| `email_capture_success` | Successfully added to Resend | `source`, `contact_id` |
| `email_capture_duplicate` | Email already in list | `source` |
| `email_capture_error` | Resend API failure | `source`, `error_type` |

**Distinct ID:** `anonymous` (no user tracking on marketing site)

**Non-blocking:** All PostHog calls via `ctx.waitUntil()`.

---

### Marketing Site Events

**Component-level events (Next.js):**

| Event | Trigger | Properties |
|-------|---------|------------|
| `email_capture_view` | EmailCapture component rendered | `source`, `variant` |
| `email_capture_submitted` | Form submitted | `source`, `variant` |

**Implementation:** Client-side PostHog SDK on marketing site — LIVE (2026-03-09).
- `posthog-js` installed in `app-next`
- `PostHogProvider` component: `app-next/components/PostHogProvider.tsx`
- Wraps marketing layout, captures `$pageview` on every route change
- Env vars: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (must be set in Cloudflare Pages dashboard)

---

## Privacy & Compliance

### Data Storage

**What is stored:**
- Email address only
- No name, phone, or other PII

**Where:**
- Resend Audience (primary storage)
- No email storage in SnapToSize databases or KV

**Retention:**
- Until user unsubscribes
- Unsubscribe link in all emails (Resend automatic)

---

### Privacy Policy Update

**Required:** Update `/privacy` page with:
- Email collection disclosure
- Purpose: Lead magnet delivery + marketing emails
- Third-party: Resend for email delivery
- User rights: Unsubscribe anytime
- Data retention: Until unsubscribe

---

## Required Secrets (Worker)

| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Already exists (used for alerts) |
| `RESEND_AUDIENCE_ID` | **New** — Audience ID for email list |

**Setup:**
```bash
wrangler secret put RESEND_AUDIENCE_ID
# Enter: aud_abc123xyz (from Resend dashboard)
```

---

## PDF Asset

**File:** `app-next/public/assets/etsy-print-size-cheat-sheet.pdf`

**Hosting:** Served from marketing site (Cloudflare Pages)

**URL:** `https://snaptosize.com/assets/etsy-print-size-cheat-sheet.pdf`

**Contents:**
- All 5 ratio groups (2:3, 3:4, 4:5, ISO, extras)
- Pixel dimensions at 300 DPI for each size
- File naming conventions
- Quick reference table
- SnapToSize branding + "Start Free" CTA at bottom

**Format:** 1-page PDF, optimized for print or digital viewing.

---

## Implementation Checklist

**Worker (services/worker):**
- [ ] Add `POST /subscribe` endpoint
- [ ] Integrate Resend Audience API
- [ ] Add rate limiting (10 req / 10 min per IP)
- [ ] Add error handling + Pushover alerts
- [ ] Add PostHog events (email_capture_*)
- [ ] Add `RESEND_AUDIENCE_ID` secret

**Marketing Site (app-next):**
- [ ] Create `components/EmailCapture.tsx`
- [ ] Create `components/ExitIntentModal.tsx`
- [ ] Add EmailCapture to hero section
- [ ] Add EmailCapture to bottom of /etsy-print-sizes
- [ ] Implement exit-intent trigger
- [ ] Add client-side PostHog events
- [ ] Create PDF asset: `etsy-print-size-cheat-sheet.pdf`
- [ ] Update `/privacy` page

**Resend Dashboard:**
- [ ] Create Audience: "SnapToSize Email List"
- [ ] Create email template: `welcome-pdf-delivery`
- [ ] Create email template: `sizing-mistakes-guide`
- [ ] Create email template: `product-cta`
- [ ] Set up automated sequence (Day 0, Day 3, Day 7)
- [ ] Test sequence with test email

---

# 10. Multi-Channel Alerting (LIVE — 2026-03-04)

## Tier 1: Critical Infrastructure (Pushover + Email)

**R2 Storage Failures:** /upload, /upload-zip, /download-by-key → "SnapToSize R2 Error"
**JWKS Auth Failures:** Clerk JWKS unreachable → "SnapToSize Auth Error" (rate limited: 1 alert/15 min)
**Job Failures:** Runner failed, stuck jobs, timeout → "SnapToSize Error"

Channels fire simultaneously. Required secrets: PUSHOVER_TOKEN, PUSHOVER_USER_KEY, RESEND_API_KEY, ALERT_EMAIL.

## Tier 2: Pattern Tracking (PostHog)

Non-blocking via ctx.waitUntil(). Fail-silent. Dashboard in PostHog UI.

## Tier 3: Logging (Cloudflare Workers Logs)

Structured JSON via wLog() helper. Request-level, runner API calls, KV operations.

**Philosophy:** Critical failures trigger Tier 1 (immediate alert) AND Tier 2 (event tracking) for post-mortem.

---

# 11. Frontend Error Monitoring (Sentry — LIVE — 2026-03-04)

Sentry SDK (@sentry/nextjs):
- Client, server, and edge runtime configs
- Instrumentation hook for Next.js App Router
- Source maps uploaded on build
- React ErrorBoundary for crash recovery

Instrumented routes:
- /api/stripe/webhook — signature + processing errors
- /api/stripe/checkout — session creation failures
- /api/stripe/portal — customer/portal errors

Alerts: Webhook failures → immediate email | Checkout failures → email every 5 min | Portal failures → every 30 min

Env vars: NEXT_PUBLIC_SENTRY_DSN, SENTRY_AUTH_TOKEN

---

# 12. JWT Diagnostic Logging (LIVE — 2026-03-03)

Worker logs jwt_fail_reason on all JWT verification failures:

| Reason | Meaning |
|--------|---------|
| kid_not_found | Signing key mismatch — JWKS doesn't contain token's kid |
| kid_not_found_after_refresh | kid still missing after JWKS cache refresh |
| signature_invalid | Token signature doesn't match |
| expired | Token past exp claim |
| wrong_alg | Algorithm not RS256 |
| jwt_issuer_mismatch | iss claim doesn't match CLERK_ISSUER |

Logs fire only on errors. Zero cost in normal operation.

---

# 13. Known Technical Debt

**Legacy dual KV write (LOW):** Remove legacy `{id}` write once frontend reads `job:{id}`.

**KV race conditions (LOW, non-critical):** Rate limit/quota/active job counters use read-modify-write. No atomic increment in KV. Impact: user may occasionally bypass limit by 1 request. Fix with Durable Objects if proven problematic at scale.

**JWKS cache in-memory (INFO):** Cached 10 min per isolate. Multiple isolates may fetch independently. Not a problem — Clerk handles this fine.

---

# 14. What Is NOT Built Yet (Technical)

- **Email capture system** (specification complete in §9.5, implementation pending)
- Subscription lifecycle UX polish (cancel_at_period_end display, portal clarity)
- Client-side funnel tracking on marketing site (UTM attribution — pageview tracking LIVE, UTM attribution pending)
- First export event tracking (Worker enqueue_success correlation)
- Remove debug endpoints (LOW priority)
- CLI debug script (Layer 5)

---

# 15. Implementation Rules (for Claude Code)

- No Worker contract breakage
- Stripe is subscription authority
- Clerk mirrors state only
- No architecture drift
- No client-side plan trust
- No new systems without explicit approval
- Growth > Features
- No new product features until ≥ 50 paying users AND ≥ 7% free → pro conversion

---

# 16. Marketing Site Performance (LIVE — 2026-03-08)

## Hero Background Optimization

**Problem:** Hero_image.png (2.6MB) caused 76s LCP on mobile.

**Solution:** Converted to WebP via sharp (quality 80) → 88KB (97% reduction).

**Implementation:**
- `public/Hero_image.webp` (88KB) — primary source
- `public/Hero_image.png` (2.6MB) — fallback for browsers without WebP
- `HeroSection.tsx` uses `<picture>` element:
  ```html
  <picture>
    <source srcSet="/Hero_image.webp" type="image/webp" />
    <img src="/Hero_image.png" fetchpriority="high" loading="eager" ... />
  </picture>
  ```

**Constraint:** `images: { unoptimized: true }` in next.config — Cloudflare Pages limitation. Do not change.

**Rule:** All new hero/background images on marketing pages should follow the same `<picture>` WebP + PNG pattern.

---

# 17. OG Images & Social Previews (LIVE — 2026-03-08)

## Generation Method

OG images are generated using **Playwright MCP CLI** — automated browser screenshots of hero sections.

**Process:**
1. Start dev server (`npm run dev`)
2. Use Playwright to navigate to page and screenshot the hero section
3. Save screenshot as PNG to `public/assets/og/`
4. Reference in page metadata via `<meta property="og:image">` and `<meta name="twitter:card">`

**Files:**
| Page | OG Image |
|------|----------|
| / (homepage) | `/assets/og/home.png` |
| /etsy-print-sizes | `/assets/og/etsy-print-sizes.png` |
| /etsy-print-ratios | `/assets/og/etsy-print-ratios.png` |
| /how-to-sell-digital-downloads-on-etsy | `/assets/og/how-to-sell-digital-downloads-on-etsy.png` |
| /what-files-to-include-etsy-digital-download | `/assets/og/what-files-to-include-etsy-digital-download.png` |
| /etsy-20mb-file-limit | `/assets/og/etsy-20mb-file-limit.png` |

**Twitter card:** `summary_large_image` on all pages — shows large preview image when link is shared.

**Rule:** When adding new SEO pages, generate an OG image using Playwright and add meta tags for both OpenGraph and Twitter card.