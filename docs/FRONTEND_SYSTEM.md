# SnapToSize Frontend — Complete System Reference

> **Repo:** snaptosize-app
> **URL:** https://app.snaptosize.com
> **Stack:** Next.js 16.1.6 · React 19 · Tailwind CSS v4 · Cloudflare Pages
> **Last updated:** 2026-03-23

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Repository Structure](#2-repository-structure)
3. [Environment Variables](#3-environment-variables)
4. [Configuration Files](#4-configuration-files)
5. [Authentication (Clerk)](#5-authentication-clerk)
6. [Error Monitoring (Sentry)](#6-error-monitoring-sentry)
7. [API Routes](#7-api-routes)
8. [Pages & Routes](#8-pages--routes)
9. [Components](#9-components)
10. [State Management](#10-state-management)
11. [Styling & Theme](#11-styling--theme)
12. [Third-Party Integrations](#12-third-party-integrations)
13. [Key Patterns](#13-key-patterns)
14. [Package Dependencies](#14-package-dependencies)

---

## 1. Architecture

```
Browser → Next.js (Cloudflare Pages) → Worker API → R2/Runner → Browser
```

- Frontend never talks directly to Worker or R2
- All backend communication proxied through Next.js API routes (edge runtime)
- Static prerendering with edge runtime for API routes
- Worker is the single source of truth for quota, plan gating, job processing

---

## 2. Repository Structure

```
snaptosize-app/
├── app/                        # Next.js App Router
│   ├── api/                    # API route handlers (edge runtime)
│   │   ├── analytics/
│   │   │   └── billing-view/route.ts
│   │   ├── download/route.ts
│   │   ├── enqueue/route.ts
│   │   ├── sentry-test/route.ts
│   │   ├── size-request/route.ts  # Size request form (PostHog + Resend)
│   │   ├── status/route.ts
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts
│   │   │   ├── portal/route.ts
│   │   │   └── webhook/route.ts
│   │   └── upload/route.ts
│   ├── app/                    # Main app routes
│   │   ├── billing/page.tsx
│   │   ├── components/
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── GenerateButton.tsx
│   │   │   ├── JobCard.tsx
│   │   │   ├── PackSelector.tsx
│   │   │   ├── SizeRequestLink.tsx  # Inline "Missing a size?" form
│   │   │   └── UploadZone.tsx
│   │   ├── layout.tsx          # Mode tabs (Packs / Quick Export)
│   │   ├── lib/
│   │   │   └── size-catalog.ts
│   │   ├── packs/page.tsx
│   │   ├── page.tsx            # Redirects to /app/packs
│   │   └── quick-export/page.tsx
│   ├── components/
│   │   └── Header.tsx
│   ├── lib/
│   │   └── posthog.ts
│   ├── login/
│   │   ├── page.tsx
│   │   └── sso-callback/page.tsx
│   ├── signup/
│   │   ├── page.tsx
│   │   └── sso-callback/page.tsx
│   ├── globals.css
│   ├── layout.tsx              # Root: ClerkProvider, fonts, Sentry
│   └── page.tsx                # Redirects to /app/packs
├── docs/
│   ├── GROWTH_STATE.md         # Business authority
│   ├── PROJECT_STATE.md        # Technical authority
│   └── FRONTEND_SYSTEM.md     # This file
├── public/                     # Static assets, favicons
├── instrumentation.ts          # Sentry init hook
├── middleware.ts               # Clerk auth + Cloudflare workarounds
├── next.config.ts
├── sentry.client.config.ts
├── sentry.edge.config.ts
├── sentry.server.config.ts
├── package.json
└── tsconfig.json
```

---

## 3. Environment Variables

### Client-side (NEXT_PUBLIC_)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key |
| `NEXT_PUBLIC_APP_URL` | Base URL for redirects (e.g. `https://app.snaptosize.com`) |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry error tracking DSN |

### Server-side (edge runtime)

| Variable | Purpose |
|----------|---------|
| `WORKER_BASE_URL` | Backend Worker URL. All API routes proxy here |
| `CLERK_SECRET_KEY` | Server-side auth |
| `STRIPE_SECRET_KEY` | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `PRICE_ID_PRO_MONTHLY` | Stripe price ID for monthly plan |
| `PRICE_ID_PRO_YEARLY` | Stripe price ID for yearly plan |
| `SENTRY_AUTH_TOKEN` | Source map upload |
| `POSTHOG_HOST` | Analytics host (default: `https://eu.posthog.com`) |
| `POSTHOG_API_KEY` | Server-side analytics key |
| `RESEND_API_KEY` | Email notifications for size requests (optional) |

All variables must be set in the Cloudflare Pages dashboard for production.

---

## 4. Configuration Files

### next.config.ts

Wraps with `withSentryConfig` from `@sentry/nextjs`. Minimal config — no custom settings.

### middleware.ts

Clerk middleware with Cloudflare Pages workarounds:

- **Protected routes:** `/app/billing(.*)`, `/app/dashboard(.*)`
- **Server Action POST intercept:** Returns no-op response for Clerk's `invalidateCacheAction` on static pages (prevents 405)
- **Stripe redirect:** Converts POST to 303 redirect for checkout returns

### tsconfig.json

- Target: ES2017, strict mode
- Path alias: `@/*` → `/*`

### postcss.config.mjs

Uses `@tailwindcss/postcss` (Tailwind v4).

---

## 5. Authentication (Clerk)

**Package:** `@clerk/nextjs` v6.37.4

### Provider Setup

`ClerkProvider` wraps the entire app in `app/layout.tsx`:
```
Sign In URL:  /login
Sign Up URL:  /signup
After Sign In: /app
After Sign Up: /app
```

### JWT Template

Template name: **"snap"**
```json
{ "plan": "{{user.public_metadata.plan}}" }
```

Used by all API proxy routes to forward auth to the Worker.

### Plan Detection

```typescript
// Client-side
const { user } = useUser();
const isPro = (user?.publicMetadata as { plan?: string })?.plan === "pro";

// Server-side (API routes)
const { userId, getToken } = await auth();
const token = userId ? await getToken({ template: "snap" }) : null;
```

### User Metadata

| Field | Location | Values |
|-------|----------|--------|
| `plan` | `publicMetadata` | `"free"` or `"pro"` |
| `stripeCustomerId` | `privateMetadata` | Stripe customer ID |

### Login/Signup Pages

- `/login` — Clerk `<SignIn />` component
- `/signup` — Clerk `<SignUp />` component
- `/login/sso-callback` — SSO redirect handler → `/app/packs`
- `/signup/sso-callback` — SSO redirect handler → `/app/packs`

### Cloudflare Pages Workaround

Clerk's server action POSTs fail on static pages (405). Two fixes:

1. **Middleware:** Intercepts POST with `next-action` header, returns empty RSC response
2. **Client:** Header component sets `window.__unstable__onBeforeSetActive = () => Promise.resolve()`

---

## 6. Error Monitoring (Sentry)

**Package:** `@sentry/nextjs` v10.42.0

### Three Runtime Configs

| File | Runtime | Extras |
|------|---------|--------|
| `sentry.client.config.ts` | Browser | Session Replay integration |
| `sentry.edge.config.ts` | Edge (API routes) | Minimal |
| `sentry.server.config.ts` | Node | Minimal |

All share: `tracesSampleRate: 1.0`, `debug: false`

Client adds: `replaysOnErrorSampleRate: 1.0`, `replaysSessionSampleRate: 0.1`

### Instrumentation Hook

`instrumentation.ts` loads the correct Sentry config per runtime:
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}
```

### Error Boundary

`app/app/components/ErrorBoundary.tsx` — React class component that catches errors, reports to Sentry with component stack, shows friendly reload UI.

### Instrumented Routes

All Stripe routes report errors to Sentry with user context. Test endpoint at `/api/sentry-test`.

---

## 7. API Routes

All routes use `export const runtime = "edge"` for Cloudflare Pages.

### Worker Proxy Routes

All follow the same pattern: auth via Clerk JWT → proxy to `WORKER_BASE_URL` → structured JSON logging.

#### POST /api/upload

Uploads image to Worker.

- **Request:** Binary image data
- **Response:** `{ image_key: string }`
- **Auth:** Optional

#### POST /api/enqueue

Enqueues a processing job.

- **Request:** `{ image_key, group, mode?, orientation?, size? }`
- **Response:** `{ job_id, remaining?: { quick, batch } }`
- **Auth:** Required
- **Errors:** 402 (quota), 429 (too many active jobs)

#### GET /api/status

Polls job status.

- **Query:** `?job_id=...`
- **Response:** `{ status, state, done, error? }`
- **Auth:** Optional

#### GET /api/download

Downloads completed job result.

- **Query:** `?job_id=...`
- **Response:** Binary (ZIP or JPG) with Content-Disposition
- **Auth:** Optional

### Stripe Routes

#### POST /api/stripe/checkout

Creates Stripe Checkout session.

- **Request:** `{ interval: "monthly"|"yearly", source?, kind? }`
- **Response:** `{ url: string }`
- **Flow:** Get user email → create session → track `checkout_started` → return URL

#### POST /api/stripe/portal

Opens Stripe billing portal.

- **Response:** `{ url: string }`
- **Flow:** Resolve/create Stripe customer → store `stripeCustomerId` in Clerk → create portal → track `portal_opened`

#### POST /api/stripe/webhook

Handles Stripe webhook events.

- **Signature verification** via `stripe-signature` header
- **Idempotency** via in-memory Set

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set plan to `"pro"` |
| `customer.subscription.updated` | Update plan based on status |
| `customer.subscription.deleted` | Set plan to `"free"` |

Plan logic: `["active", "trialing", "past_due"]` → `"pro"`, everything else → `"free"`

### Size Request Route

#### POST /api/size-request

Captures user-submitted size requests (inline form on packs/quick-export pages).

- **Request:** `{ size: string, page: "packs"|"quick-export" }`
- **Auth:** Required (Clerk)
- **Actions:**
  - PostHog event `size_requested` with size, page, user_email, plan
  - Resend email to support@snaptosize.com (if `RESEND_API_KEY` set)
- **Response:** `{ ok: true }`

### Analytics Route

#### POST /api/analytics/billing-view

- **Request:** `{ source?, kind?, success?, canceled? }`
- **Events:** `billing_view` (always), `upgrade_clicked` (when source present)
- **CRITICAL:** All `posthogCapture()` calls are **awaited** (edge runtime requirement)

---

## 8. Pages & Routes

### Root Redirects

| Path | Behavior |
|------|----------|
| `/` | `redirect("/app/packs")` |
| `/app` | `redirect("/app/packs")` |

### App Layout (`app/app/layout.tsx`)

Mode navigation tabs:
- **Packs** (Layers icon) → `/app/packs`
- **Quick Export** (Zap icon) → `/app/quick-export`

### /app/packs — Batch Pack Export

Generate multiple print-size ZIP packs from one image.

**Onboarding guide:** Always visible (not dismissible). Shows 3 steps: Upload your artwork → Pick your ratio packs → Download Etsy-ready ZIPs.

**Flow:**
1. Upload file → `/api/upload` → `image_key`
2. Sequential processing — for each selected pack:
   - Enqueue → `/api/enqueue` → `job_id`
   - Poll `/api/status` every 1s until done/error (3min timeout)
   - Then enqueue next pack
3. Show results with download buttons

**Free vs Pro:**
- Free: 1 pack processes, rest shown as "locked" with upgrade CTA
- Pro: All selected packs process sequentially

**5 Packs:**
| Key | Label | Sizes |
|-----|-------|-------|
| `2x3` | 2×3 Ratio | 4x6, 6x9, 8x12, 10x15, 12x18, 16x24, 20x30, 24x36 |
| `3x4` | 3×4 Ratio | 6x8, 9x12, 12x16, 15x20, 18x24, 24x32 |
| `4x5` | 4×5 Ratio | 8x10, 12x15, 16x20, 20x25, 24x30 |
| `iso` | ISO A-Series | A5, A4, A3, A2, A1 |
| `extras` | Common Sizes | 5x7, 8.5x11, 11x14, 13x19, 20x24 |

### /app/quick-export — Single JPG Export

Export one print-ready JPG at a specific size and orientation.

**Onboarding guide:** Always visible (not dismissible). Shows 3 steps: Upload your artwork → Pick size & orientation → Download print-ready JPG.

**Flow:**
1. Select orientation (Portrait / Landscape / Square)
2. Select ratio group (hidden for Square)
3. Select size from dropdown
4. Upload → Enqueue with `mode: "single"` → Poll → Download

**Size Catalog:** `app/app/lib/size-catalog.ts` — all sizes at 300 DPI with pixel dimensions. Includes square sizes (5x5, 8x8, 10x10, 12x12, 16x16, 20x20).

### /app/billing — Subscription Management

**For free users:** Pricing cards with upgrade CTAs
**For Pro users:** "Manage subscription" → Stripe billing portal

**Pricing:**
- Yearly: $97/year ($8.08/mo) — "Best value", "Save 33%"
- Monthly: $11.99/mo

**Query params:** `?success=1`, `?canceled=1`, `?source=limit&kind=FREE_BATCH_LIMIT`

**Attribution flow:**
```
User hits limit → /app/billing?source=limit&kind=FREE_BATCH_LIMIT
  → billing_view + upgrade_clicked events
  → checkout_started (with source/kind)
  → checkout_completed (with source/kind via metadata)
```

---

## 9. Components

### Header (`app/components/Header.tsx`)

- Logo + brand link
- Auth state: SignedIn (plan badge, sign out) / SignedOut (login link)
- Pro badge or "Upgrade" button based on plan

### UploadZone (`app/app/components/UploadZone.tsx`)

- Drag & drop + click to browse
- Image preview with zoom modal (click to expand)
- File info (name, size), remove button
- Free users: watermark text notice ("Free: includes watermark · Remove") linking to billing
- Props: `{ file, onFileChange, disabled, isPro }`

### PackSelector (`app/app/components/PackSelector.tsx`)

- 5 pack toggle cards in 2-column grid
- "Select all" / "Deselect all" buttons
- Selected state with purple glow + checkmark
- Size list preview per pack
- Props: `{ selected, onToggle, onSelectAll, disabled }`

### JobCard (`app/app/components/JobCard.tsx`)

Per-pack status card with 6 states:

| Status | Label | Icon | Action |
|--------|-------|------|--------|
| `idle` | Idle | Clock | — |
| `queued` | Queued | Clock | — |
| `running` | Processing | Loader (spin) | — |
| `done` | Ready | CheckCircle2 | Download ZIP button |
| `error` | Failed | AlertCircle | Retry button (if provided) |
| `locked` | Pro | Lock | "Unlock Pro" → billing |

Micro-interactions: slide-in animation on mount, success-pop scale when status transitions to "done".

Debug panel visible in dev or with `?debug=1`.

### GenerateButton (`app/app/components/GenerateButton.tsx`)

- Gradient purple button
- States: default (Sparkles icon) / loading (spinning Loader)
- Props: `{ disabled, loading, onClick, label?, loadingLabel? }`

### SizeRequestLink (`app/app/components/SizeRequestLink.tsx`)

Inline form for users to request missing sizes. States: link → input + send button → "Thanks!" confirmation. Submits to `/api/size-request`. Used on both packs and quick-export pages below the pack/size selector.

- Props: `{ page: "packs"|"quick-export" }`

### ErrorBoundary (`app/app/components/ErrorBoundary.tsx`)

React class component. Catches errors → reports to Sentry → shows "Something went wrong" with reload button.

---

## 10. State Management

No global state library. Uses React `useReducer` per page.

### Packs Page State

```typescript
type State = {
  phase: "idle" | "uploading" | "enqueuing" | "polling" | "done" | "error"
  file: File | null
  selected: Record<Group, boolean>     // Pack selection
  imageKey?: string
  jobs: Partial<Record<Group, Job>>    // Per-pack job status
  globalError?: string
  recentDownloads: RecentDownload[]    // Session-scoped, max 5
  remaining?: { quick: number; batch: number }  // Quota
  batchProgress?: { current: number; total: number }
}
```

**Key actions:** `set_file`, `toggle_group`, `select_all`, `set_phase`, `set_job`, `set_global_error`, `set_batch_progress`, `add_recent_download`, `set_remaining`, `reset`

### Quick Export State

```typescript
interface State {
  phase: Phase
  file: File | null
  group: CatalogGroup               // "2x3" | "3x4" | "4x5" | "iso" | "extras"
  orientation: "Portrait" | "Landscape" | "Square"
  sizeId: string
  imageKey?: string
  job?: JobInfo
  globalError?: string
  recentDownloads: RecentDownload[]
  remaining?: { quick: number; batch: number }
}
```

### Recent Downloads

In-memory, session-scoped. Max 5, newest first. Filtered to exclude currently processing jobs.

```typescript
interface RecentDownload {
  label: string
  completedAt: number
  downloadUrl: string    // /api/download?job_id=...
  jobId: string
}
```

---

## 11. Styling & Theme

### Tailwind CSS v4

No `tailwind.config.js`. Uses CSS variables and `@theme inline` in `globals.css`.

### Color Palette

```css
--background: #0B0B12     /* Dark background */
--foreground: #E5E5E5     /* Light text */
--accent: #7C3AED         /* Purple primary */
--accent-light: #8B5CF6   /* Lighter purple */
--success: #22C55E        /* Green */
--error: #EF4444          /* Red */
--surface: #13111C        /* Card background */
--border: #1E1B2E         /* Border color */
```

### Fonts

- Sans: **Geist** (via `next/font/google`)
- Mono: **Geist Mono** (via `next/font/google`)

### Custom Utilities

| Class | Effect |
|-------|--------|
| `.glow-purple` | Purple box-shadow glow |
| `.gradient-btn` | Purple gradient background (135deg) |
| `@keyframes pulse-dot` | Pulsing opacity animation (1.5s) |
| `.animate-slide-in-up` | Slide up + fade in (0.3s ease-out) |
| `.animate-success-pop` | Scale bounce on completion (0.4s) |

---

## 12. Third-Party Integrations

### Clerk — Authentication

- ClerkProvider, clerkMiddleware, JWT templates
- `publicMetadata.plan` for plan gating
- `privateMetadata.stripeCustomerId` for Stripe linking

### Stripe — Payments

- **API version:** `"2026-01-28.clover"`
- Products: Pro Monthly ($11.99), Pro Yearly ($97)
- Checkout → Portal → Webhook lifecycle
- Plan sync via webhook → Clerk metadata update

### Sentry — Error Tracking

- Multi-runtime (client, server, edge)
- Session Replay on client
- Source map upload on build
- Custom ErrorBoundary

### PostHog — Analytics

- Server-side only via `app/lib/posthog.ts`
- `posthogCapture(distinctId, event, properties)` — must be awaited on edge
- Distinct IDs: `clerk:{userId}` (authenticated) or `ip:{ip}` (Worker/anonymous)
- Events: `billing_view`, `upgrade_clicked`, `checkout_started`, `checkout_completed`, `portal_opened`, `subscription_updated`, `subscription_deleted`, `size_requested`

### Lucide React — Icons

`lucide-react` v0.575.0. Used throughout for all iconography.

---

## 13. Key Patterns

### Worker Proxy Pattern

All API routes follow this structure:

```typescript
export const runtime = "edge";

export async function POST(req: Request) {
  const base = process.env.WORKER_BASE_URL?.replace(/\/$/, "");
  const requestId = crypto.randomUUID();
  const { userId, getToken } = await auth();
  const token = userId ? await getToken({ template: "snap" }) : null;

  const res = await fetch(`${base}/endpoint`, {
    headers: {
      "x-request-id": requestId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...
  });

  // Structured JSON logging
  console.log(JSON.stringify({ layer: "next", event: "worker_call", ... }));

  return new Response(body, { status: res.status });
}
```

### Sequential Pack Processing

Packs process one at a time to prevent Worker `ctx.waitUntil()` timeout:

```
for each pack:
  POST /api/enqueue     ← await response
  poll /api/status      ← await done/error (1s interval, 3min timeout)
  → then next pack
```

If a pack fails, processing continues with remaining packs.

### Free/Pro Gating

Client-side display only (server enforces via Worker):

```typescript
const toEnqueue = isPro ? selectedGroups : selectedGroups.slice(0, 1);
// Additional packs marked as "locked" with upgrade CTA
```

Server returns 402 when quota exceeded → frontend shows upgrade CTA.

### Error Code Mapping

| HTTP Status | Error Code | UI Behavior |
|-------------|-----------|-------------|
| 402 | `QUOTA:FREE_BATCH_LIMIT` | Upgrade CTA card |
| 429 | `too_many_active_jobs` | "Too many exports running" message |
| Other | Generic | Error message display |

### Attribution Tracking

```
Upgrade link: /app/billing?source=limit&kind=FREE_BATCH_LIMIT
  → billing_view event
  → upgrade_clicked event (with source/kind)
  → checkout_started (source/kind in metadata)
  → checkout_completed (source/kind forwarded)
```

---

## 14. Package Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.6 | Framework |
| `react` / `react-dom` | 19.2.3 | UI library |
| `@clerk/nextjs` | ^6.37.4 | Authentication |
| `stripe` | ^20.3.1 | Payment processing |
| `@sentry/nextjs` | ^10.42.0 | Error tracking |
| `lucide-react` | ^0.575.0 | Icons |

### Dev

| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | ^4 | CSS framework |
| `@tailwindcss/postcss` | ^4 | PostCSS plugin |
| `typescript` | ^5 | Type checking |
| `eslint` / `eslint-config-next` | ^9 / 16.1.6 | Linting |

---

## Ground Truth Documents

- **Technical:** `docs/PROJECT_STATE.md`
- **Business:** `docs/GROWTH_STATE.md`
- **Execution rules:** `.claude/CLAUDE.md`
