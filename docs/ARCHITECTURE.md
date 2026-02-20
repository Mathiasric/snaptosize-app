# NEXT PHASE – SaaS ARCHITECTURE PLAN

## Phase 1 – Separate App from Marketing
- Keep snaptosize.com as marketing site
- Create app.snaptosize.com (Next.js)
- No iframe embedding
- Worker remains API gateway

## Phase 2 – Auth + Stripe
- Clerk authentication
- Stripe Checkout
- Stripe webhook → KV entitlement

## Phase 3 – Replace Gradio
- /app/new upload flow in Next.js
- Pass X-User-Id + X-Plan to Worker
- Deprecate Fly frontend

# SnapToSize — SaaS App Build Spec (Polished Login + Billing + Engine Access)
**Purpose:** Guide Cursor to build a production-grade SaaS app UI (Next.js) on top of the already-working engine (Worker/Runner/R2).  
**Strict:** This doc is for building the app. The engine already works.

---

## 0) Current Reality (Do Not Rebuild)
Engine is already working and stable:

- Cloudflare Worker handles:
  - `/enqueue`, `/status/<job_id>`, `/download/<job_id>` (redirect to presigned)
  - FREE quota enforcement (3 per 24h)
  - FREE watermark via `payload.demo=true`
  - PRO watermark blocked (demo forced false for pro)
  - Presigned R2 URLs returned in status
- Runner (`snaptosize-runner2` on Fly) handles:
  - image processing, zip creation, R2 upload
  - MAX_CONCURRENCY semaphore in `/generate`
  - NoSuchKey on `image_key` returns 404 (not 500)
- R2 presign works (secrets fixed)

**Rule:** Do NOT change Worker/Runner behavior unless a task explicitly says so.

---

## 1) Goal (What We Are Building Now)
Build a **polished SaaS web app** with:

- Clean login experience
- Stripe subscriptions
- Plan enforcement server-side
- Great UX around free/pro limits
- Calls engine via Worker API
- Looks/feels like a real product

---

## 2) Domain Model
- `snaptosize.com` → marketing (can remain static/Next later)
- `app.snaptosize.com` → Next.js SaaS app (this project)
- `api.snaptosize.com` → Worker (preferred) OR keep workers.dev temporarily

---

## 3) Tech Choices (Best-Practice, Minimal Regret)
**Frontend App:** Next.js (App Router) + TypeScript  
**Auth:** Clerk  
**Billing:** Stripe Subscriptions  
**Plan Source of Truth:** server-side (Clerk metadata updated by Stripe webhook)  
**Engine Calls:** app → Worker only (never directly to Runner or R2)

---

## 4) Repo Structure (What Cursor Must Create)
Create a NEW folder in repo root:


---

## 5) Absolute Non-Negotiable Rules
### Security / Correctness
1) Never trust client headers like `X-Plan` for production gating.
2) Plan must be derived server-side from verified identity.
3) Stripe webhook MUST verify signature.
4) Webhook route MUST run on Node runtime (not Edge).
5) App never calls Runner or R2 directly. Only the Worker API.

### Cursor Execution Discipline
- Only edit files inside `/app-next/**` unless a task explicitly expands scope.
- Minimal diffs. No refactors unless requested.
- One task per prompt. Stop when task done.

---

## 6) Plan Enforcement Model (How SaaS Actually Works)
**Stripe → webhook → Clerk privateMetadata.plan**

- Default: `plan = "free"`
- If subscription status is `"active"` or `"trialing"`: set `plan="pro"`
- If canceled/inactive: set `plan="free"`

App reads plan from Clerk server-side.
Worker will later verify JWT and enforce plan server-side (Phase 4).

---

## 7) UX Requirements (Polished)
### Free user experience
- Can generate up to 3/day
- Free exports watermarked
- When limit hit:
  - Show a clean paywall (not “error”)
  - Copy (English):  
    “You’ve used your 3 free exports for today. Upgrade to Pro for unlimited exports, or try again in 24 hours.”

### Pro user experience
- No watermark
- Unlimited exports
- Billing page shows “Manage subscription”

### Errors must not look broken
- `FREE_LIMIT_REACHED` → paywall UI
- `429/503` → “We’re at capacity, retrying…”
- `500` → “Something went wrong. Please try again.”

---

## 8) Build Phases (Strict Order)
### Phase 1 — App Skeleton + Auth (Clerk)
**Done when:**
- `/sign-in`, `/sign-up` work
- `/app` requires auth
- dashboard shows user + plan placeholder

### Phase 2 — Billing (Stripe)
**Done when:**
- Upgrade starts Stripe checkout
- Manage opens Stripe portal
- Webhook updates Clerk metadata plan

### Phase 3 — App “Generate” page calls Worker
**Done when:**
- Upload image
- Choose sizes
- App calls Worker `/enqueue`
- Poll `/status`
- Show presigned download links
- Show paywall on 402

### Phase 4 — Server-side enforcement at Worker (JWT)
**Done when:**
- App sends Bearer token
- Worker validates JWT and derives plan
- Worker enforces quota + watermark + pro correctly without trusting client

NOTE: Phase 4 touches Worker code; do not start it until Phases 1–3 are working.

---

## 9) Worker API Contract (Assumed)
Worker endpoints:
- `POST /enqueue` → `{ ok: true, job_id, remaining? }` OR `402 FREE_LIMIT_REACHED`
- `GET /status/<job_id>` → `done` includes `download_url`
- (optional) `POST /upload` if used by your current client pipeline

App must not invent new endpoints unless explicitly planned.

---

## 10) Environment Variables (App)
Clerk:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/app`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/app`

Stripe:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_MONTHLY`
- `STRIPE_PRICE_ID_YEARLY`
- `APP_URL=https://app.snaptosize.com`

Worker:
- `WORKER_BASE_URL=https://api.snaptosize.com` (or workers.dev while migrating)

---

## 11) Definition of Done (v1 SaaS)
- User can: Sign up → upgrade → generate → download (no watermark)
- Free user can: generate 3/day → watermarked downloads → paywall at limit
- No plan trust in frontend
- Stripe webhook verified and idempotent
- App feels clean and stable

---

## 12) Cursor Prompt Contract (How We Work)
Every Cursor task prompt must include:
- Allowed files (usually `/app-next/**`)
- Exact deliverables
- Stop criteria (“Done when…”)
- No refactor clause
- Output clause (diffs + run commands)

END
