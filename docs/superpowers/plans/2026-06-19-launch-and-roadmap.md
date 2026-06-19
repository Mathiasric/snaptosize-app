# Mode Launch + Roadmap — 2026-06-19

The work record for the Perfect-Fit-exposure launch + the prioritized backlog of
undone/potential work, so any of it can be picked up in one read. Companion to
`2026-06-19-mode-display.md` (the original mode-display plan + Size Packs warning spec).

---

## What shipped this session (the launch)

All assembled on branch **`feat/launch`** (off `main`), pushed, **CF preview build = GREEN**.
The two feature branches merged conflict-free (disjoint files):

| Piece | Where | Notes |
|---|---|---|
| My Packs warning copy softened | `main` (`d1eaddc`) | **Already live.** Geometry-as-reason, dropped "stretch/poor/blocked". |
| 4-tab mode bar (Size Packs · Perfect Fit[NEW] · Quick Export · My Packs) | `feat/mode-display` | Ordered by usage (Packs 71% hero); Perfect Fit adjacent to teach Fill-vs-Frame; mobile = single-line scroll. |
| `/perfect-fit` → `/app/perfect-fit` route move | `feat/mode-display` | Inherits the bar. Old route 404s. |
| Perfect Fit upload format guard | `feat/mode-display` | |
| Size Packs orientation nudge (soft, → Perfect Fit) | `feat/size-packs-orientation-warning` | Fires only on landscape/square (runner force-resizes = distorts). Reuses My Packs 0.95–1.05 classifier. CTA click tracked. |
| Button guidance (Size Packs + Quick Export) | same | Disabled button now states *why*. |
| My Packs ratio-preview chip contrast | same | Read as intentional, not empty. |
| Friendlier "Your artwork" placeholder | same | Was dev-ish `your_artwork` mono. |
| `pack_export_started` / `quick_export_started` | same | Closes the start→complete funnel gap (all 4 modes now have it). |
| Upload format guard, all modes (JPG/PNG/WEBP only) | same + mode-display | Was `image/*` → accept-then-fail at runner. Extension fallback for odd MIME. Clear reject message. |
| "JPG, JPEG, PNG, or WEBP" format hint on all uploads | `feat/launch` | UploadZone had none before; JPEG spelled out. |
| `orientation_nudge_perfect_fit_clicked` event | `feat/launch` (`6942393`) | The cross-ratio crop-demand signal (see single-crop decision). |

**Verification:** Playwright DOM assertions on every UI change (button labels, format
reject + valid-load regression, warning fires landscape / silent portrait, chips, hints);
`tsc` clean throughout; CF production build green.

**Alerting/observability (confirmed, no work needed):** export failures on **all 4 modes**
alert via Pushover (phone) + email — secrets `PUSHOVER_TOKEN`/`PUSHOVER_USER_KEY`/`ALERT_EMAIL`
are set. Alerts fire on 5xx/timeout after retries, include `mode` (Perfect Fit = `mode: crop`).
Per-mode performance + error logging in place (job lifecycle + `job_error` w/ mode + PostHog).

---

## To finish the launch (remaining)

1. **Merge `feat/launch` → main** = prod deploy (go-live). Held for explicit user go.
2. **On prod immediately:** Perfect Fit's **authed export** (Clerk can't auth on localhost / *.pages.dev, so this is prod-only) + **free-watermark spot-check** (confirm a free crop ZIP is watermarked). Rollback = `git revert`.

---

## Backlog — undone / potential work (priority order)

### 1. Mockups (biggest adjacent bet)
Room-scene art-in-frame listing images. The #1 thing rivals offer that we don't
(Bulk Mockup, Canva, Placeit, Creative Market). Different *product*, not sizing.
Parked future opportunity — see memory `project_mockup_opportunity`.

### 2. Batch / bulk (multiple artworks at once)
We process one artwork at a time; PixelBatch et al. do bulk. Real power-seller need.
Separate big-bet.

### 3. Single-export crop (DECIDED: defer, measure first)
- **Why deferred:** single resize is the *commodity* (every generic tool has it) → low
  ceiling, not a differentiator. Real cost is **runner-side** (new single-size crop path +
  payload = a production backend deploy + the "unify Fill/Frame" architecture), not the app toggle.
- **Decision rule:** review at **4 weeks** post-launch (2-week early peek).
  - NO-GO if Perfect Fit itself sees little use (`perfect_fit_export_started/completed`).
  - Consider building only if `orientation_nudge_perfect_fit_clicked` shows real cross-ratio
    crop demand AND Perfect Fit has traction.
- **North star alternative:** rather than bolt single-crop on, the elegant end-state is an
  **upload-first canvas with a Resize⟷Crop toggle** across scopes (single/pack/custom) —
  dissolves the scope-vs-method split entirely. Bigger build; the thing to grow *toward*.

### 4. My Packs free-limit conversion experiment
Free = 1 saved pack; 17 `my_packs_ceiling_upsell_viewed` in 30d. How the wall is
communicated is a conversion lever. Run as a deliberate A/B with measurement, not a gut tweak.

### 5. Image carry-over across modes
Only valuable as the handoff for the Size Packs → Perfect Fit CTA (so the nudge doesn't dump
users on an empty re-upload). Needs a shared upload store (sessionStorage/IndexedDB or a
provider above both routes). Low standalone value; build with the north-star canvas.

### 6. Fly log-drain (observability gap, pre-existing)
Runner logs are ephemeral (`fly logs` live only, not persisted/searchable). Doesn't affect
alerts or metrics — only deep post-incident forensics. Add if searchable runner history wanted.

### 7. Watermark upsell copy A/B (optional optimization)
Current copy ("That's watermarked. Pro isn't… Remove the watermark →") is honest, on-pattern
(Canva/video tools/remove.bg), and the primary free→pro lever. Good as-is; optimize only via
measured A/B, never a pre-launch gut change.

---

## Decisions locked (don't relitigate)
- **Restrained design is correct** for these utility modes — more color/flourish would read as
  marketing and undercut "this tool just does the job." Size Packs empty-state is **fine, no action**.
- **On *sizing*, we cover everything an Etsy seller needs** and are ahead of rivals (packs +
  distortion-free crop; rivals mostly do commodity single resize). No missed *sizing* opportunity.
- **Warning/error copy:** geometry is the reason, never the product the villain. See memory
  `feedback_warning_copy_tone`.
- **DO-NOT-BUILD:** CMYK/TIFF (per memory `project_perfect_fit_strategic_review`).

---

## Strategy & sequencing (Jun 19 reflection)
- **Reality check:** ~25 lifetime Pro users, 1 annual (early). The constraint is **volume + brand trust, not price** — better product (Perfect Fit done) + marketing-site/social trust-building drive conversions.
- **Pricing: keep stable** ($11.99/mo, $97/yr). Too little data to change anything; raising price on thin volume hurts. Annual is arguably *underpriced* for serious sellers — room to test ~$119 **later, only after conversion is healthy**. Don't add 3/6-month tiers (decision friction + cannibalizes annual).
- **Revenue path:** sizing beachhead → distribution works → **~$100k ARR** (a traffic/funnel problem; product is ready). **$1M ARR is NOT reachable on sizing alone** (bounded niche + free-tool pressure cap it ~$100–300k). The $1M bridge is **mockups** (bigger market, higher WTP, same customer) — but **far future, only after the sizing product has solidified + distribution works + the beachhead is won.** Do not chase mockups prematurely.
- **MVA (Norwegian VAT):** threshold NOK 50k/12mo **per ENK (all activity combined)**; SnapToSize alone likely under. When crossed, **absorb the 25% (don't raise price)** while small + competing vs free. EU digital-service VAT is separate — use Stripe Tax + a regnskapsfører. Don't let MVA drive pricing now. (Orientation only — not tax advice.)
