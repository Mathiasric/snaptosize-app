# GROWTH_STATE.md
## SnapToSize — Growth & Business State

Last updated: 2026-03-23

---

**This file is the authoritative source for business strategy, growth execution, ICP, funnel, channels, and revenue tracking.**

For technical infrastructure, see PROJECT_STATE.md.

---

# 1. Business Overview

SnapToSize is a SaaS tool for Etsy sellers selling digital wall art / printables.

**Core promise:**
> Upload one high-resolution image → receive ready-to-sell print size ZIP packs for all major Etsy ratios.

**Strategic positioning:**
> SnapToSize = Etsy-native print pack generator.

**Differentiators:**
- Exact Etsy aspect ratios (2:3, 3:4, 4:5, ISO A-series, extras)
- 300 DPI output
- No cropping — stretch-only (deliberate product differentiator)
- Organized ZIP structure with professional naming
- Under Etsy's 20MB hard limit
- Single exports (Quick Export) for individual sizes
- Faster than any manual Photoshop/Canva workflow

**Long-term market:**
- **Phase 1:** Etsy (current focus — do not expand until traction proven)
- **Phase 2:** Shopify, Creative Market, Gumroad (future, no timeline)

---

# 2. Current Status

- **Product:** Live and production-stable as of 2026-03-03
- **First paying customer:** 2026-03-03
- **Paying users:** 3 (~$36 MRR)
- **SEO pages live:** 7
- **Email list:** Lead capture component live on site
- **Pipelines built:** SEO (10 pages/week) + Social (7 videos + 21 pins/week)
- **Video:** Remotion rendering working (TikTokVertical template)
- **Active distribution:** Starting this week (March 11)
- See MILESTONES.md for full build status
- See CONTENT_PLAYBOOK.md for channel strategies and content specs

---

# 3. Ideal Customer Profile (ICP)

## Primary ICP

- Etsy sellers selling DIGITAL wall art / printables
- 10–200 listings OR consistent sales history
- Already earns > $500/mo (not beginners)
- **Pain points:** resizing, packaging, naming, Etsy upload compliance

## Secondary ICP

- POD creators scaling listing count
- Bundle sellers needing consistent size sets

## Not targeting

- Hobby/one-off Canva users
- Generic "image resizer" traffic
- People who don't sell on Etsy (until Phase 2)

---

# 4. Pricing

**Monthly:** $11.99/mo
**Yearly:** $97/year ($8.08/mo — saves 33%)

**Free plan limits:**
- 5 Quick Exports/day
- 2 Packs/day
- Watermark on outputs

**Pro plan:**
- Unlimited Quick Exports
- Unlimited Packs
- No watermark
- Priority processing

**Pricing lock rule:**
> No pricing changes before 100 paying users OR statistically significant churn data.
> Do not change price without signal.

**Planned pricing experiments:**
- Test monthly vs. annual positioning (annual as "business expense")
- Yearly discount anchoring
- Feature gating (see §14)

---

# 5. North Star Metric

**Primary:** Weekly Pro activations (count)

**Secondary metrics:**
- Free → Pro conversion rate
- Time-to-first-export (TTFE)
- Upgrade click rate after 402
- Job success rate (error %)
- **Organic traffic** (sessions/month)
- **Active paying users** (MRR contributors)

**Targets:**
- Free → Pro conversion ≥ 7% (minimum viable)
- Free → Pro conversion ≥ 10% (goal)
- TTFE ≤ 60 seconds median
- Job success rate ≥ 99%
- **Organic traffic:** 20k+ sessions/month within 12 months
- **Conversion from traffic:** 5–10% of free users upgrade to paid

**Activation definition:**

User is **Activated** when:
1. First successful export (pack OR single)
2. Within first session
3. No 402 encountered

**Activation rate target:** ≥ 60%

---

# 6. Revenue Milestones

| Milestone | Goal |
|-----------|------|
| 10 paying users | Validate willingness to pay |
| 100 paying users | Validate retention + pricing |
| 500 paying users | Prove growth engine |
| 1000+ paying users | Scale distribution |
| **$1M ARR** | Long-term target (2,500–4,000 users at $11.99–$29/mo) |

**Revenue tracking (Stripe source of truth):**

Track weekly: MRR, net revenue, Pro activations, churn, annual vs monthly split.

---

# 7. Upgrade Funnel (PostHog — LIVE)

All events verified live 2026-03-01:

| Step | Event | Status |
|------|-------|--------|
| Billing page view | `billing_view` | LIVE |
| Upgrade click | `upgrade_clicked` | LIVE |
| Checkout started | `checkout_started` | LIVE |
| Checkout completed | `checkout_completed` | LIVE |
| Portal opened | `portal_opened` | LIVE |
| Subscription changed | `subscription_updated` | LIVE |
| Subscription canceled | `subscription_deleted` | LIVE |
| Size requested | `size_requested` | LIVE |

**Not yet tracked:**
- Landing → App click (requires marketing site UTM instrumentation)
- App → First export (requires Worker enqueue_success correlation)

**Attribution chain (implemented):**

Upgrade links pass `?source=` and `?kind=` → billing page → checkout POST body → Stripe session metadata → webhook reads into `checkout_completed`.

**PostHog dashboard:** "SnapToSize – Upgrade Attribution" (setup in PostHog UI).

**Implementation rule:**

Every funnel step uses consistent `distinct_id = clerk:{userId}` + properties (`source`, `kind`, `plan_before`/`plan_after`).

---

# 8. Marketing Channels

**Active channels and full specs → see CONTENT_PLAYBOOK.md**

**Summary:**
- **SEO:** 10 pages/week via automated pipeline
- **TikTok + Reels:** 7 videos/week (1/day), dual-posted, Remotion-rendered
- **Pinterest:** 21 pins/week (3/day)
- **Community outreach:** Reddit + Facebook groups (manual)
- **YouTube, affiliates, paid ads:** Not started (gated by milestones)

**Positioning:** "Built for Etsy sellers" — exact ratios, no cropping, 20MB compliance, time saved

---

# 9. SEO Content

## Homepage Performance & Social Previews

**Hero LCP fix (2026-03-08):** Converted Hero_image.png (2.6MB) → WebP (88KB). Uses `<picture>` with WebP primary + PNG fallback. Added `fetchpriority="high"` and `loading="eager"`.

**OG images (2026-03-08):** All pages have OpenGraph + Twitter card (`summary_large_image`) meta tags with Playwright-generated hero screenshots. Images in `/assets/og/`. Ensures link previews show hero image on Twitter, Facebook, Slack, etc.

---

## Live Pages (6)

### /etsy-print-sizes — Pillar Page (PRODUCTION)

**URL:** https://snaptosize.com/etsy-print-sizes
**Published:** 2025-02-10 | **Modified:** 2026-03-03
**Status:** Indexed, re-indexing requested 2026-03-03
**Schema:** Article + BreadcrumbList + FAQPage (5 questions)
**OG/Twitter:** Custom hero image
**Internal links:** /pricing, /sizes, /etsy-print-ratios, app
**Target keywords:** "Etsy print sizes", "Etsy print ratios", "300 DPI print sizes", "Etsy 20MB limit"

**Content:**
- Crop-to-fit vs SnapToSize comparison (visual proof)
- Common Etsy Print Mistakes (6 cards)
- Complete ratio tables: 2:3, 3:4, 4:5, ISO A-series, extras at 300 DPI
- Collapsible FAQ
- Social proof: "Over 18,000 size packs generated"
- Trust pills + micro-benefit chips
- 4 internal CTAs

---

### /etsy-print-ratios — Supporting Page (PRODUCTION)

**URL:** https://snaptosize.com/etsy-print-ratios
**Published:** 2026-03-04 | **Modified:** 2026-03-04
**Status:** Deployed, ready for indexing. Sitemap priority: 0.8
**Schema:** Article + BreadcrumbList + FAQPage (5 questions)
**OG/Twitter:** hero_og_etsy-print-ratios.png
**Internal links:** /etsy-print-sizes, /sizes, /pricing, /guide (bidirectional with pillar)
**Target keywords:** "etsy print ratios", "etsy printable ratios", "print ratio packs"

---

### /how-to-sell-digital-downloads-on-etsy (PRODUCTION)

**URL:** https://snaptosize.com/how-to-sell-digital-downloads-on-etsy
**Target keywords:** "how to sell digital downloads on Etsy", "Etsy digital products"

**Content:**
- Guide for new sellers covering research, pricing, creating listings
- Technical requirements for digital downloads
- Internal links to SnapToSize product
- Multiple CTAs

---

### /what-files-to-include-etsy-digital-download (PRODUCTION)

**URL:** https://snaptosize.com/what-files-to-include-etsy-digital-download
**Target keywords:** "what files to include etsy digital download"

**Content:**
- Explains which files to include in Etsy digital download listings
- Emphasizes ratios, file types, Etsy policies
- Internal links to size/ratio pages
- CTAs to SnapToSize

---

## SEO Cluster Expansion (PLANNED)

### High-Priority Pages (Next 6 months)

**1. /etsy-20mb-file-limit**
- **Target:** "etsy 20mb limit", "etsy file size limit"
- **Content:** Explains Etsy's 20MB limit, how to compress files without losing quality
- **CTA:** SnapToSize automatically stays under limit

**2. /printable-wall-art-sizes**
- **Target:** "printable wall art sizes", "poster sizes", "canvas sizes"
- **Content:** Broader guide covering common print sizes beyond Etsy (posters, canvases, frames)
- **Strategy:** Capture external searchers who later discover Etsy

**3. /how-to-create-etsy-listing-files**
- **Target:** "how to create etsy listing files", "etsy file preparation"
- **Content:** Tutorial on workflow and automation
- **Structure:** Show manual steps → present SnapToSize as shortcut

**4. Problem-based FAQ pages**
- **Target:** "etsy file too big", "etsy dpi error", "cannot upload digital files"
- **Content:** FAQ-style pages targeting long-tail, high-intent queries
- **Strategy:** Capture users actively troubleshooting

---

### Content Velocity

**Target:** 10 pages/week via automated SEO pipeline (see CONTENT_PLAYBOOK.md for full specs)

---

# 10. Lead Capture System (NOT YET BUILT — NEXT PRIORITY)

## Lead Magnet

**"Free Etsy Print Size Cheat Sheet" PDF**

- All Etsy ratios, pixel dimensions at 300 DPI, file naming conventions
- Relevant to ICP pain point
- Positions SnapToSize as authority

**Alternative lead magnet:**
- **Ratio calculator widget** (interactive tool requiring email)

---

## Placement (3 locations on marketing site)

1. **Hero section** — secondary CTA under "Start Free"
2. **Exit-intent popup** — once per session
3. **Bottom of /etsy-print-sizes** — post-content natural placement

---

## Tech Stack

- **Resend API** (already integrated via alerts@snaptosize.com domain)
- **Resend Audience** for list storage
- PDF delivered via automated Resend trigger email

---

## Email Sequence (3 emails)

| Email | Timing | Content |
|-------|--------|---------|
| 1 | Immediate | PDF delivery + welcome |
| 2 | Day 3 | "Common Etsy print sizing mistakes" + soft CTA |
| 3 | Day 7 | Direct: SnapToSize solves this automatically + free plan CTA |

**Nurture strategy:**
- Periodic new guide releases
- Product updates
- Success stories from sellers who upgraded

---

## Implementation Specification

### Frontend Component (Marketing Site)

**Component:** `app-next/components/EmailCapture.tsx`

**Props:**
```typescript
{
  source: 'hero' | 'exit_intent' | 'etsy_print_sizes'
  variant?: 'inline' | 'modal'
  className?: string
}
```

**Behavior:**
- Client-side validation (email format)
- Loading state during submission
- Success state with confirmation message
- Error state with retry option
- Tracks submission via PostHog: `email_capture_submitted`

**Exit-intent modal:**
- Component: `app-next/components/ExitIntentModal.tsx`
- Trigger: Mouse leaves viewport toward top
- Frequency: Once per session (localStorage)
- Dismissible with "No thanks" option

---

### API Integration

**Endpoint:** `POST /subscribe` (Worker)

**Request:**
```json
{
  "email": "seller@example.com",
  "source": "hero"
}
```

**Response (success):**
```json
{
  "success": true,
  "contact_id": "resend_contact_id"
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "Invalid email format"
}
```

**Error handling:**
- Duplicate emails: Return success (silent, no user error)
- Invalid email: Return validation error
- Resend API failure: Log + alert via Pushover, return generic error

---

### Resend Configuration

**Resend Audience:**
- Audience ID: `RESEND_AUDIENCE_ID` (Worker env var)
- Audience Name: "SnapToSize Email List"

**Automated Email Sequence:**

Configured in Resend dashboard:

**Email 1 — Welcome + PDF (Immediate)**
- From: alerts@snaptosize.com
- Subject: "Your Free Etsy Print Size Cheat Sheet"
- Template: `welcome-pdf-delivery`
- Attachment: `etsy-print-size-cheat-sheet.pdf`
- Unsubscribe link: included

**Email 2 — Sizing Mistakes (Day 3)**
- From: alerts@snaptosize.com
- Subject: "6 Common Etsy Print Sizing Mistakes (and how to avoid them)"
- Template: `sizing-mistakes-guide`
- CTA: Link to /etsy-print-sizes

**Email 3 — Product CTA (Day 7)**
- From: alerts@snaptosize.com
- Subject: "Stop spending 3 hours per listing"
- Template: `product-cta`
- CTA: "Start Free" → app.snaptosize.com

---

### PDF Asset

**File:** `app-next/public/assets/etsy-print-size-cheat-sheet.pdf`

**Contents:**
- All 5 ratio groups (2:3, 3:4, 4:5, ISO, extras)
- Pixel dimensions at 300 DPI
- File naming conventions
- Quick reference table
- SnapToSize branding + CTA at bottom

**Delivery method:**
- Resend attachment (primary)
- Fallback: Direct download link if attachment fails

---

### Privacy & Compliance

**Privacy policy update:**
- Update `/privacy` page with email collection disclosure
- Explain use of Resend for email delivery
- Include data retention policy

**Unsubscribe:**
- Resend handles unsubscribe links automatically
- One-click unsubscribe in all emails

**Data storage:**
- No PII beyond email stored in SnapToSize systems
- Email stored in Resend Audience only

---

### Analytics

**PostHog events:**

| Event | Trigger | Properties |
|-------|---------|------------|
| `email_capture_view` | Component displayed | `source`, `variant` |
| `email_capture_submitted` | Form submitted | `source`, `variant` |
| `email_capture_success` | Successful submission | `source`, `contact_id` |
| `email_capture_error` | Submission failed | `source`, `error_type` |

**Distinct ID:** `anonymous` (pre-signup) or `clerk:{userId}` (if authenticated)

---

### Worker Implementation

See PROJECT_STATE.md §7.5 for technical Worker implementation details.

---

# 11. Conversion Optimization

## Implemented

✅ **Free remaining counts shown in app UI** (2026-03-04)
- Packs: badge shown when `remaining.batch ≤ 1`
- Singles: badge shown when `remaining.quick ≤ 2`
- Creates urgency without noise

✅ **Watermark text notice on preview** (2026-03-23)
- Free users see "Free: includes watermark · Remove" on uploaded image preview
- Links to /app/billing?source=watermark-preview
- No visual CSS watermark overlay (would misrepresent actual output quality)

✅ **Billing page redesigned** (2026-03-23)
- Free vs Pro comparison table with clear feature matrix
- Social proof: "Trusted by Etsy sellers who skip the Photoshop grind."
- Free plan limits clearly stated (5 Quick Exports/day, 2 ZIP Packs/day, watermark)

✅ **Onboarding guide always visible** (2026-03-23)
- 3-step guide on both packs and quick-export pages
- Not dismissible (previously stored dismiss in localStorage which persisted across sessions/logouts)

✅ **Size request form** (2026-03-23)
- Inline "Missing a size? Let us know" form on both pages
- Captures PostHog event `size_requested` + email to support@snaptosize.com
- Zero friction (no app exit required)

✅ **JobCard micro-interactions** (2026-03-23)
- Slide-in animation on mount
- Success-pop scale animation when job completes

✅ **UpsellBanner: sessionStorage + outcome copy** (2026-04-10)
- Shows once per session only (was: reset on every export render)
- Copy shifted from feature-list to consequence framing: "That took 30 seconds. / Files you can actually sell with."
- Moved toward watermark-removal emphasis per planned A/B direction

✅ **Quota error urgency copy** (2026-04-10)
- "Your next listing can't wait until tomorrow."
- Targets highest-intent upgrade moment (limit hit)

✅ **Billing headline + subheadline** (2026-04-10)
- Headline: "Stop resizing. Start selling."
- Subheadline: "Upload once, get every size — no watermark, no daily reset panic."

✅ **Generate button always visible at small viewports** (2026-04-10)
- Left panel uses flex column + internal scroll
- CTA never clipped on 720px viewport

---

## Planned Experiments

### In-Product Upsell (High Priority)

**Trigger:** After successful export completion

**Format:**
- Show comparison: Manual workflow vs. SnapToSize automation
- Display time saved: "You saved 2.5 hours preparing this listing"
- CTA: "Upgrade to Pro for unlimited exports"

**A/B test variants:**
- Immediate modal vs. banner notification
- Time-saved emphasis vs. watermark removal emphasis

---

### Paywall UX Improvements

- **Inline upsell after 402** (one-click to billing)
- **Annual plan highlight** + anchor pricing
- **Checkout abandonment tracking**
- **Exit-intent paywall** on billing page

---

### Free Plan Positioning

**Clarity improvements:**
- Emphasize time saved (1–3 hours per listing)
- Highlight compliance assurance (20MB limit, 300 DPI)
- Show success stories from sellers who upgraded

---

# 12. Product Expansion (Future — Post-Validation)

**Rule:** No new product features until ≥ 50 paying users AND ≥ 7% free → pro conversion validated.

---

## Planned Features (Phase 2)

### 1. Batch Processing

**Value prop:** High-volume shops need to process entire catalogs

**Feature:** Upload 10 images → generate 70+ files automatically

**Pricing tier:** Premium tier above Pro ($29–$49/mo)

---

### 2. Custom Ratios & Planners

**Expand beyond wall art:**
- Planners, calendars, other printable niches
- Non-standard sizes (1:1 squares, 16:9 screensavers)
- Widens TAM without deviating from core capability

---

### 3. Feature Gating Strategy

**Free tier:** Core ratio generation (current state)

**Pro tier:** Unlimited exports, no watermark (current state)

**Premium tier (future):**
- Batch uploads
- Custom crop previews
- Additional file formats (PNG, TIFF)
- Priority processing queue

**Goal:** Incentivize upgrades without alienating hobbyists

---

### 4. Platform Expansion

**Once Etsy vertical saturated:**

- **Shopify:** Dedicated landing page `/shopify-printable-sizes`
- **Creative Market:** Adapt messaging for CM sellers
- **Gumroad:** Target creators selling direct

**Strategy:** Same compliance engine, different messaging. Each platform adds to TAM.

---

### 5. Adjacent Market: Social Media Content Creators

**Discovery date:** 2026-03-09

**Origin:** While creating Instagram content for SnapToSize marketing, used the product to convert Pinterest pins (2:3 ratio, 1536x2752px) to Instagram feed posts (4:5 ratio, 1080x1350px). Product worked flawlessly for this use case.

**Opportunity:**

Social media managers, content creators, and marketers need to optimize images across platforms with different aspect ratio requirements:

**Platform Requirements:**
- Pinterest: 2:3 (1000x1500px)
- Instagram Feed: 4:5 (1080x1350px) or 1:1 (1080x1080px)
- Instagram Stories/Reels: 9:16 (1080x1920px)
- TikTok: 9:16 (1080x1920px)
- LinkedIn: 1.91:1 (1200x627px)
- Twitter/X: 16:9 (1200x675px)

**Current workflow pain point:** Manual resizing in Photoshop/Canva for each platform (same problem as Etsy sellers, different ratios).

**SnapToSize value prop:** Upload once → get all social media ratios automatically.

**Market size:**
- Social media managers: 200K+ globally
- Content creators: Millions (Instagram/TikTok creators)
- Marketing agencies: Need bulk social media image optimization

**Positioning:**
- Primary: Still Etsy sellers (don't dilute)
- Secondary messaging: "Works for social media too" (low-effort expansion)
- Landing page (future): `/social-media-image-sizes`

**Why this works:**
- Same core technology (aspect ratio conversion)
- No product changes needed
- Widens TAM without pivot
- Self-discovered through "dogfooding" (using own product)

**Validation needed:**
- ≥50 paying Etsy users first (don't expand before core proven)
- Test messaging: "Not just for Etsy" campaigns
- Track signups from social media creator segment

**Risk mitigation:**
- DO NOT pivot away from Etsy focus
- Only surface this as secondary use case in marketing
- No dedicated product features until Etsy vertical saturated

**Status:** Opportunity documented. Revisit after 50 paying users milestone.

---

# 13. What Is NOT Built Yet (Growth Layer)

See MILESTONES.md for full build status (what's built vs not built).

---

# 14. Operating Rules

**Growth > features**

- No new product features until ≥ 50 paying users AND ≥ 7% free → pro conversion validated
- One channel must prove before adding another
- Pricing locked until 100 paying users
- **Content velocity:** 1–2 SEO guides/month until 8–10 pages live
- Update existing pages quarterly

**Sources of truth:**

- **Stripe:** Revenue tracking
- **PostHog:** Funnel tracking
- **Google Search Console:** SEO performance

**Path to $1M ARR:**

Dominate "Etsy printable sizing" niche through:
1. High-intent SEO content
2. Smart distribution (Pinterest + communities)
3. Product that solves painful workflow problem
4. Clear conversion funnel
5. Expand to adjacent markets ONLY after Etsy penetration proven

**Philosophy:**

Stability > cleverness
Clarity > abstraction
Education > promotion
Execution > theory
Growth > features