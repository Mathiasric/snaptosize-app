# Sentry Error Tracking

## Overview

Sentry error tracking is implemented for both client-side and server-side errors in the Next.js app, with special focus on revenue-critical Stripe webhook failures.

## Setup

### 1. Environment Variables

Add to `.env.local`:

```bash
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@o0.ingest.sentry.io/0000000
SENTRY_AUTH_TOKEN=your-auth-token-here
```

Get these from:
1. Go to sentry.io
2. Create new project: "snaptosize-frontend"
3. Copy DSN from Settings → Client Keys
4. Create auth token from Settings → Auth Tokens (scope: project:releases)

### 2. Instrumented Routes

Critical error tracking is active on:

- **`/api/stripe/webhook`** — Stripe webhook processing failures
  - Signature validation errors (warning level)
  - Event processing failures (error level)
  - Tags: event_type, event_id

- **`/api/stripe/checkout`** — Checkout session creation failures
  - Tags: user_id, interval
  - Context: checkout details

- **`/api/stripe/portal`** — Billing portal failures
  - Customer creation/lookup errors
  - Portal session creation errors
  - Tags: user_id, error_type

### 3. Client-Side Error Boundary

React error boundary component available at:
`app/components/ErrorBoundary.tsx`

Usage:
```tsx
import { ErrorBoundary } from "@/app/components/ErrorBoundary";

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

## Features Enabled

- ✅ Source maps upload for production debugging
- ✅ Session replay (10% sample rate, 100% on errors)
- ✅ Performance monitoring (100% sample rate)
- ✅ User context tracking (userId from Clerk)
- ✅ Ad-blocker bypass via `/monitoring` tunnel route
- ✅ Automatic React component annotation

## Alert Configuration (Recommended)

Set up alerts in Sentry dashboard:

1. **Critical: Webhook Failures**
   - Condition: event_type = "checkout.session.completed" AND level = "error"
   - Alert: Immediately via email/Slack

2. **High: Checkout Failures**
   - Condition: route = "/api/stripe/checkout" AND level = "error"
   - Alert: Within 5 minutes

3. **Medium: Portal Failures**
   - Condition: route = "/api/stripe/portal" AND level = "error"
   - Alert: Daily digest

## Source Maps

Source maps are automatically uploaded during production builds via `@sentry/nextjs` webpack plugin.

Requires `SENTRY_AUTH_TOKEN` to be set.

## Testing

Test Sentry integration:

```bash
# Client-side error
throw new Error("Sentry test error");

# Server-side error (in API route)
import * as Sentry from "@sentry/nextjs";
Sentry.captureException(new Error("Test server error"));
```

## Production Deployment

On Cloudflare Pages, add environment variables:
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

Source maps will be uploaded automatically during build.

## Performance Impact

- Client bundle: +~50KB gzipped
- Server: Negligible (async error reporting)
- Build time: +10-30s (source map upload)

## Status

- Implemented: 2026-03-04
- Status: Production ready
- Coverage: Stripe webhooks, checkout, portal, React crashes
