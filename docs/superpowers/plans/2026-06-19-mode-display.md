# Mode-Display + Perfect Fit Launch — Implementation Plan

> Branch-only. Verify on localhost (Clerk renders). CF `*.pages.dev` preview proves the build deploys but will NOT render Clerk-gated UI. Merge to main only on explicit user go. Adding the tab = Perfect Fit goes live.

**Goal:** Present all 4 export modes so each is instantly distinct (Fill vs Frame, both positive), lead with the proven hero, and expose the finished Perfect Fit mode — without disrupting the 3 modes that have active users.

**Architecture:** Move the hidden `/perfect-fit` route into the `/app/` route group so it inherits the shared mode tab bar, then rework the `MODES` array in `app/app/layout.tsx` (rename, reorder, add Perfect Fit). Situation-based one-line descriptors live as page subtitles; the strong anti-distortion claim lives only on the Perfect Fit page, aimed at the external enemy (manual cropping / stretchy resizers), never at our own modes.

---

## Research validation (done 2026-06-19)

- **Usage split (PostHog, last 30 days):** Size Packs 1902 (71%) · Quick Export 496 (19%) · My Packs 266 (10%). → Hero+default = Size Packs is data-backed. Quick Export is a real mode (19%); moving it 2→3 is a conscious, sized tradeoff, not free.
- **Breakage risk (cross-repo grep):** Routes `/app/packs`, `/app/quick-export`, `/app/my-packs` are unchanged — only *labels* change (display-only), so the dozens of marketing SEO deep-links do NOT break. `/perfect-fit` is referenced nowhere in marketing (hidden) and only in `PerfectFitClient.tsx` (return_to + sample img) + crop-preview imports + billing link inside the app — a small, self-contained move set.
- **Rival landscape:** No direct competitor does focal-crop-to-every-Etsy-size. Generic tools either blind-crop (composition disappears) or AI-fill. Our brand is explicitly anti-blind-crop — so Perfect Fit must position as *controlled, focal, user-framed* crop, distinct from the cropping our marketing rails against.

---

## The four modes (locked copy)

Tab bar = label + icon only (clean). Descriptor = page subtitle (situation-based, both positive).

| Order | Label | Icon | Page subtitle |
|---|---|---|---|
| 1 (default, hero weight) | **Size Packs** | Layers | Your full image, resized to every Etsy size in its ratio. |
| 2 (+ "New" badge) | **Perfect Fit** | Crop | Need a different shape? You frame it, crop to any ratio. |
| 3 | **Quick Export** | Zap | One image, one size, in seconds. |
| 4 | **My Packs** | FolderHeart | Your own saved set of sizes. |

- "New" badge on Perfect Fit only (neutral discovery cue, retired later) — NOT a "no-distortion" badge.
- Perfect Fit page hero may keep the strong claim ("reframe to any ratio, you choose what's kept, no manual cropping") aimed at the external alternative.
- OPEN JUDGMENT CALL for user: Perfect Fit at slot 2 (adjacency to Size Packs teaches Fill-vs-Frame; Quick Export shifts 2→3, stays fully visible) vs. Quick Export stays slot 2 / Perfect Fit slot 3 (respects muscle memory, loses adjacency teaching). Recommendation: slot 2.

---

## Tasks

### Task 1: Branch
- [ ] `cd /c/dev/snaptosize-app && git checkout -b feat/mode-display` (off main, clean tree first).

### Task 2: Move `/perfect-fit` into the `/app/` route group
**Files:**
- Move: `app/perfect-fit/page.tsx` → `app/app/perfect-fit/page.tsx`
- Move: `app/perfect-fit/PerfectFitClient.tsx` → `app/app/perfect-fit/PerfectFitClient.tsx`
- Move: `app/perfect-fit/lib/ratios.ts` → `app/app/perfect-fit/lib/ratios.ts`
- Leave `app/crop-preview/**` in place (shared lib + its own `/crop-preview` route).

- [ ] `git mv app/perfect-fit app/app/perfect-fit`
- [ ] In `app/app/perfect-fit/PerfectFitClient.tsx`: change the 4 crop-preview imports from `../crop-preview/...` to `../../crop-preview/...` (the dir is one level deeper now). Lines (current): `../crop-preview/lib/crop`, `../crop-preview/lib/autoFocal`, `../crop-preview/components/CropCanvas`, `../crop-preview/components/RatioStrip`.
- [ ] In the same file: change `return_to=${encodeURIComponent('/perfect-fit')}` → `'/app/perfect-fit'`.
- [ ] Confirm no other `'/perfect-fit'` literal remains in the moved files (sample img path `/perfect-fit-sample.jpg` is a public asset, leave it).

### Task 3: Rework the mode bar
**Files:** Modify `app/app/layout.tsx`

- [ ] Replace the `MODES` array with the 4 entries above, in order: Size Packs (`/app/packs`, Layers), Perfect Fit (`/app/perfect-fit`, Crop, `isNew: true`), Quick Export (`/app/quick-export`, Zap), My Packs (`/app/my-packs`, FolderHeart). Import `Crop` from lucide-react.
- [ ] Rename label `"Packs"` → `"Size Packs"` (display only; route + analytics keys unchanged).
- [ ] Add a small "New" badge render for `isNew` entries (reuse the existing `pro` badge styling pattern, neutral accent, text "New").
- [ ] Give the active/default Size Packs tab a subtle hero weight (e.g. slightly stronger idle text/icon than the other idle tabs) — keep it subtle, not a CTA.

### Task 4: Page subtitles (situation-based copy)
**Files:** Modify `app/app/packs/page.tsx`, `app/app/quick-export/page.tsx`, `app/app/my-packs/page.tsx`, `app/app/perfect-fit/PerfectFitClient.tsx`
- [ ] Add the one-line subtitle from the table near each mode's heading. Minimal cosmetic text; match each page's existing heading block. Confirm no layout shift.

### Task 5: Verify on localhost (the real QA)
- [ ] `npm run build` — 0 type errors, `/app/perfect-fit` listed, `/crop-preview` still present, no `app/perfect-fit` route remains.
- [ ] `npm run dev` + Clerk-authed session: click all 4 tabs; confirm Perfect Fit loads in its new route WITH the tab bar, upload→export still works (focal crop), and Packs / Quick Export / My Packs are functionally unchanged.
- [ ] Playwright screenshots: tab bar at desktop (1440×900) + mobile (390×844). Confirm order, "New" badge, no overflow/wrap.
- [ ] Regression: hit `/app/packs`, `/app/quick-export`, `/app/my-packs` directly (the marketing deep-link targets) — all still resolve.

### Task 6: CF preview build-safety check
- [ ] Push branch, confirm the `*.pages.dev` preview **builds and deploys clean** (catches CF-specific build breaks — tsconfig/untracked-file gotchas). Note: Clerk UI will not render there; this is a build check only.

### Task 7: Hold for go
- [ ] Do NOT merge. Report localhost verification + screenshots. Merge to main only on explicit user go. Landscape live-test already passed.

---

## After this (separate, not a blocker)
- Single-export Perfect Fit (Resize⟷Crop toggle on Quick Export): decide on PostHog signal after launch. North star = upload-first canvas with a method toggle, which dissolves the scope-vs-method awkwardness entirely. Build toward it; don't accrete more tabs.
