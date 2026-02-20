# SnapToSize — Complete System Context

# Authority Order

If multiple markdown files conflict, follow this priority:

1. CLAUDE.md (highest authority)
2. ARCHITECTURE.md
3. PROJECT_STATE.md
4. ROADMAP_1M_STRATEGY.md
5. Any other documentation

Never override CLAUDE.md unless explicitly instructed.

All system-level architectural decisions must align with docs/ARCHITECTURE.md.
All current state references must align with docs/PROJECT_STATE.md.


You are operating inside a production SaaS system.

Your role:
- Maintain architectural integrity
- Avoid improvisation
- Respect existing contracts
- Do not introduce new systems unless explicitly requested
- Optimize for deterministic, scalable SaaS architecture

---

# 1. Product Overview

SnapToSize is a SaaS tool that:

- Takes one high-resolution image
- Generates multiple print-size variants
- Packages them into a ZIP
- Delivers via download

Primary audience:
- Etsy sellers
- Digital print creators
- Print-on-demand creators

Core value:
Automation of multi-ratio print sets.

---

# 2. System Architecture

### A. Frontend (SaaS App)

Repo: snaptosize-app  
Stack:
- Next.js (App Router)
- Clerk authentication
- Cloudflare Pages deployment
- Custom domain: app.snaptosize.com

Responsibilities:
- Authentication
- Dashboard
- File upload UI
- Job submission
- Polling
- Download delivery
- Future: Stripe billing

Frontend must never directly call R2.

---

### B. Worker (API Layer)

Hosted on Cloudflare Workers.

Current base:
https://worker.snaptosize-mathias.workers.dev

Future base:
https://api.snaptosize.com

Responsibilities:
- Accept image uploads
- Store in R2
- Enqueue jobs
- Return job status
- Serve download
- Enforce quota logic (future)

Worker is stateless API layer.

---

### C. Runner

Hosted on Fly.io.

Responsibilities:
- Process queued jobs
- Resize images
- Generate ZIP
- Store ZIP in R2
- Update job status

Runner never handles auth.

---

### D. Storage

Cloudflare R2

Stores:
- Original image
- Generated ZIP

Worker handles presign/download.

---

# 3. Current Worker Contract (Immutable)

POST /upload  
→ raw image bytes  
→ returns { image_key }

POST /enqueue  
→ { image_key, group, demo? }  
→ returns { job_id, remaining? }

GET /status/:job_id  
→ returns job status JSON

GET /download/:job_id  
→ returns ZIP stream

POST /upload-zip  
→ internal only

These endpoints must not change without explicit instruction.

---

# 4. Next Proxy Layer

Located in:
app/api/

Routes:
- POST /api/upload
- POST /api/enqueue
- GET /api/status
- GET /api/download

Responsibilities:
- Require Clerk auth
- Forward to Worker
- Return response unchanged
- No mutation of payload

Environment variable:
WORKER_BASE_URL

---

# 5. Authentication

Clerk protects:
- /app
- /api/* routes

All Worker interaction must pass through authenticated Next routes.

---

# 6. Phases

### Phase 1 — Replace Gradio
- Proxy complete
- Upload UI
- Polling
- Download

### Phase 2 — Monetization
- Stripe integration
- Free quota limit
- Pro plan unlimited
- Enforce via Worker

### Phase 3 — Scale
- Analytics
- Rate limiting
- Observability
- Retry logic
- Logging

---

# 7. Non-Goals (For Now)

Do not:
- Add database
- Add background queues in Next
- Add Stripe yet
- Modify Worker logic
- Refactor Runner
- Introduce new APIs

---

# 8. Gradio

Gradio exists as legacy MVP.
Do not delete.
Do not refactor.
It is fallback only.

---

# 9. Deployment Model

Marketing site:
snaptosize.com → static Next site

App:
app.snaptosize.com → Next SaaS

Worker:
workers.dev (temporary) → api.snaptosize.com (future)

Runner:
Fly.io

---

# 10. Coding Rules

When implementing:

- No speculative architecture
- No refactors unless requested
- No new abstractions
- Minimal code
- Deterministic logic
- Explicit file paths
- Production-ready patterns


# Execution Mode

When implementing features:

- Think step-by-step.
- Do not assume missing endpoints.
- Ask for clarification if Worker contract is unclear.
- Never introduce new architecture layers without explicit request.

Be precise.
