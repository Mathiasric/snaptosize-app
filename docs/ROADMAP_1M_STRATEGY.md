# SNAP TO SIZE — $1M ROADMAP  
**Version 1.0 — Strategic & Technical Blueprint**

---

# 1. THE REAL GOAL

SnapToSize is not a tool.  
It is a focused SaaS product.

Target:
- $1,000,000/year revenue
- ≈ $83,000/month
- 4,200 users at $19/month  
  OR  
- 2,500 users at $33 blended average

This requires:

- Clear niche focus
- High conversion landing
- Clean SaaS architecture
- Strong subscription enforcement
- Stable infrastructure
- Relentless iteration

No chaos. No side quests.

---

# 2. PRODUCT POSITIONING

We are NOT building a generic image resizer.

We are building:

> “Etsy-ready printable bundles in 1 click.”

Target user:
- Etsy digital product sellers
- Selling printable wall art
- Want instant ZIP bundles
- Don’t want Photoshop resizing workflow

Everything must support this.

No drifting into:
- Canva tool
- General design platform
- AI playground
- Marketplace

Focus = Etsy printable sellers.

---

# 3. FINAL PRODUCTION ARCHITECTURE

## Domains

- `snaptosize.com` → Marketing
- `app.snaptosize.com` → SaaS Application
- `api.snaptosize.com` → Cloudflare Worker API

---

## Infrastructure Overview

### Marketing + App
- Next.js (App Router)
- Deployed on Vercel or Cloudflare Pages
- SEO + SaaS in same project
- Separated route groups

### Authentication
- Clerk
- Plan stored in Clerk metadata

### Billing
- Stripe Subscriptions
- Stripe Webhooks update Clerk metadata

### API Layer
- Cloudflare Worker
- Enforces:
  - FREE quota (3/day)
  - FREE watermark
  - PRO unlimited
- Validates JWT
- Talks to Runner

### Processing
- Fly.io Runner
- Image resize
- ZIP creation
- Upload to R2

### Storage
- Cloudflare R2
- Presigned URLs
- Lifecycle rules for cleanup

---

# 4. PROJECT STRUCTURE (FINAL)


Old Gradio app will be phased out once Next app is live.

---

# 5. EXECUTION PHASES (STRICT ORDER)

---

## PHASE 1 — Marketing Foundation

Goal:
- Strong SEO base
- High conversion landing

Tasks:
- Port existing HTML into Next.js
- Improve hero clarity
- Add pricing section
- Add FAQ
- Add strong CTA → app

DO NOT:
- Add auth
- Touch Worker
- Touch Runner

---

## PHASE 2 — SaaS Authentication Layer

Goal:
- Real login system
- Clean protected dashboard

Tasks:
- Add Clerk
- Protect `/app`
- Show plan badge (free/pro)
- Add Upgrade button

No Stripe logic yet.

---

## PHASE 3 — Stripe Subscription Integration

Goal:
- Real SaaS billing

Tasks:
- Stripe checkout
- Stripe customer portal
- Webhook verification
- Update Clerk metadata:
  - plan: free | pro

Rules:
- Never trust frontend for plan
- Worker must derive plan from verified JWT

---

## PHASE 4 — Connect App to Worker Engine

Goal:
- Replace Gradio UI

Tasks:
- Upload image via Next
- Call Worker `/enqueue`
- Poll `/status`
- Show download links
- Handle FREE_LIMIT_REACHED properly

Gradio becomes legacy.

---

## PHASE 5 — Conversion Optimization

Goal:
- Improve ARPU
- Improve free → pro conversion

Add:
- Remaining free exports display
- Upgrade prompts
- Annual discount option
- Exit intent modals
- Simple usage dashboard

---

## PHASE 6 — Scale & Stability

Goal:
- Handle real volume

Tasks:
- Runner concurrency tuning
- Monitoring + logging
- Error tracking (Sentry)
- Rate limiting
- Analytics tracking

---

# 6. ENGINEERING RULES

1. Never trust client headers for plan.
2. Plan enforcement must be server-side.
3. Worker is the only gateway to Runner.
4. Runner is never public.
5. Stripe webhooks must verify signature.
6. JWT must be validated in Worker.
7. No refactors during active feature phase.
8. One phase at a time.

---

# 7. CONVERSION PRINCIPLES

Every page must answer:

- What is this?
- Who is this for?
- Why is this better?
- How fast?
- What do I get?
- What happens when I click?

No fluff.
No generic SaaS language.
Laser focus on Etsy sellers.

---

# 8. WHAT WE DO NOT BUILD (YET)

- No team accounts
- No advanced dashboards
- No AI features
- No image history system
- No marketplace expansion

Focus = one killer workflow.

---

# 9. SUCCESS METRICS

Early:
- 5% landing → app click
- 10% free → pro conversion

Later:
- 15% free → pro conversion
- 5% annual subscription adoption

---

# 10. CURRENT STATUS

Engine:
- Worker quota enforcement implemented
- Watermark for FREE implemented
- PRO bypass protection implemented
- Presigned R2 downloads working

Next step:
PHASE 1 — Build proper Next.js foundation.

---

# 11. STRATEGIC MINDSET

This is not a hobby project.
This is a scalable SaaS.

Rules:

- No feature creep.
- No architectural shortcuts.
- No mixing marketing and app logic.
- No rushing Stripe before foundation.
- No redesign during backend phase.

We execute in sequence.

One phase.  
Complete.  
Then move.

---

END OF DOCUMENT
