# Lead Generation Platform

> Full-stack B2B lead generation and outreach platform — built as a self-hosted, API-first SaaS alternative to Apollo.io, Hunter.io, and Captello.

---

## Project Status

| Module | Status | Tests |
|---|---|---|
| **Security & Auth** | ✅ Production-ready | 218/218 passing |
| **Leads CRM Engine** | ✅ Production-ready | 177/177 passing |
| **Capture Engine** | ✅ Production-ready | 101/101 passing |
| CRM Integrations | 🔲 Planned | — |
| Lead Enrichment | 🔲 Planned | — |
| Outreach Engine | 🔲 Planned | — |
| AI Layer | 🔲 Planned | — |

**Total: 496 tests passing · 0 failures · 0 TypeScript errors**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, TypeScript (strict ESM) |
| HTTP Framework | Fastify 4 |
| Database | PostgreSQL 16 (Drizzle ORM) |
| Cache / Sessions | Redis 7 (ioredis) |
| Passwords | Argon2id + HMAC-SHA256 pepper |
| Email | Nodemailer (SMTP) |
| Validation | Zod |
| Tests | Vitest 2 + Testcontainers + Playwright |
| Migrations | drizzle-kit |
| CSV processing | csv-parse + csv-stringify |
| QR code generation | qrcode |
| File uploads | @fastify/multipart |
| Dev infra | Docker Compose |

---

## Quick Start

**Prerequisites**: Docker Desktop, Node.js 22+

```bash
# 1. Clone and install
git clone <repo>
cd lead-generation-platform
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, PEPPER, SMTP_*, ABUSEIPDB_API_KEY

# 3. Start infrastructure + migrate
npm run db:setup

# 4. Start dev server
npm run dev        # http://localhost:3000

# 5. Run tests
npm test           # 496 unit + integration tests
npm run test:e2e   # Playwright end-to-end
```

---

## Module 1: Security & Authentication

> Full reference: [SECURITY_MODULE.md](SECURITY_MODULE.md)

The platform's first completed module. A self-contained auth subsystem with no external identity dependencies — every concern from registration through session expiry is owned, tested, and audited.

### What's built

**Registration & email verification**
- Username + email + password registration with Zod-validated schema
- Duplicate username/email rejected before Argon2 runs (avoid wasted cycles)
- Argon2id password hashing with per-instance HMAC-SHA256 pepper (64 MB / 3 passes / 4 threads)
- 6-digit CSPRNG verification code, stored in Redis with 15-minute TTL
- Best-effort SMTP dispatch — user row survives email failure

**Session management**
- 32-byte cryptographically random session ID (256-bit entropy)
- Stored in Redis: `session:{id}` → JSON payload, 7-day **sliding** TTL
- Cookie: `HttpOnly`, `Secure`, `SameSite=Strict`
- Session rotation support for privilege escalation flows
- Full logout: Redis key deleted + cookie cleared in single request

**Login + risk engine**
- Username normalised to lowercase before lookup
- Timing-safe path: password verify always runs for real users (prevents username enumeration)
- Post-auth risk scoring (parallel execution):
  - IP reputation: Tor exit node and datacenter/VPN prefix matching
  - AbuseIPDB: external abuse score → mapped to risk points
  - Failed attempts: sliding 15-minute window (≥ 3 attempts → score, ≥ 5 → block)
  - Impossible travel: Haversine distance / elapsed time > 1,000 km/h → 100 pts
  - New device: unknown fingerprint → 20 pts
- Aggregated score → `LOW / MEDIUM / HIGH / CRITICAL` → `ALLOW / STEP_UP / FORCE_REAUTH / LOCK_ACCOUNT`
- All thresholds tunable via env vars

**Password reset**
- 3-step flow: request → verify (non-consuming peek) → reset
- Silent 200 on unknown email (prevents enumeration)
- Reset code: 6-digit CSPRNG, `reset:{email}` in Redis, 1-hour TTL, single-use (atomic consume)
- On reset completion: re-hashes password + destroys ALL user sessions
- Rate limited: 3 requests / hour

**Rate limiting**
- Redis-backed via `@fastify/rate-limit` (per-IP, shared across instances when Redis is available)
- Register: 10/min · Login: 5/min · Forgot-password: 3/hr

**requireAuth middleware**
- Reads session cookie → validates Redis session → attaches `request.user` (typed)
- Reusable on any protected route as a Fastify `preHandler`

### Security event log (database)

Every auth lifecycle action is written to the `security_events` PostgreSQL table:

```
REGISTRATION_SUCCESS · EMAIL_VERIFIED · RESEND_VERIFICATION
LOGIN_FAILED · LOGIN_BLOCKED · LOGIN_SUCCESS
LOGOUT · PASSWORD_RESET_REQUESTED · PASSWORD_RESET_COMPLETED
```

The risk engine itself reads this table (last 20 events per user) to detect brute-force patterns — the log drives security decisions, not just observability.

### Structured application logs (pino)

Each HTTP request emits three log lines sharing a `reqId` correlation field:

```
incoming request   → [business event with event field]   → request completed
```

Sensitive fields (`password`, `newPassword`, `code`, `Authorization`, `cookie`) are redacted at the pino serializer level — they never reach stdout. Log level is runtime-configurable via `LOG_LEVEL` env var.

### Test coverage

```
218 tests · 0 todos · 0 TypeScript errors
├── 147 unit tests  (Vitest, fully mocked dependencies)
└──  71 integration tests  (real PostgreSQL + Redis via Testcontainers)
```

---

## Module 2: Leads CRM Engine

> Full reference: [LEADS_MODULE.md](LEADS_MODULE.md)

A complete single-user CRM backend. Every lead flows through a consistent lifecycle — capture → tag → list → note → status → blacklist — and every action is isolated per user with ownership-scoped queries.

### What's built

**Lead management**
- `POST /leads` — capture a lead with full UTM parameter tracking, qualification score, and custom answers
- `GET /leads` — paginated list with server-side filters: `status`, `captureMethod`, `limit`, `offset`
- `GET /leads/:id` — fetch single lead (ownership enforced)
- `PATCH /leads/:id` — update fields (email not mutable; status validated against `LEAD_STATUSES` constant)
- `DELETE /leads/:id` — hard delete, cascades tags/notes/list membership
- Duplicate email per user → `409 DUPLICATE_LEAD` (unique constraint: `user_id + email`)

**Tags**
- `POST /leads/:id/tags` — add tag (idempotent)
- `DELETE /leads/:id/tags/:tag` — remove tag
- Tags stored as rows in `lead_tags(lead_id, tag)` — no length cap on tag count

**Notes**
- `POST /leads/:id/notes` — append a freeform text note with `createdBy` attribution
- `GET /leads/:id/notes` — list all notes for a lead (ordered by `created_at` ASC)

**Lists** (static segments)
- `POST /lists` — create a named lead list
- `GET /lists` — list all lists for the user
- `GET /lists/:id` — get list with members
- `PATCH /lists/:id` — rename
- `DELETE /lists/:id` — delete with cascade list memberships
- `POST /lists/:id/members` — bulk-add lead IDs (validates ownership of each lead)
- `DELETE /lists/:id/members/:leadId` — remove from list

**Blacklist**
- `POST /leads/blacklist` — add email or domain to blacklist
- `GET /leads/blacklist` — retrieve entries
- `DELETE /leads/blacklist/:id` — remove entry
- Any `captureLead` call against a blacklisted email or domain → `422 BLACKLISTED_LEAD` — blocks all capture paths including forms, badge scan, and CSV import

**Lead status pipeline**
- `PATCH /leads/:id/status` — update pipeline stage
- Valid statuses defined in `src/leads/statuses.ts` as `as const` array (zero schema migration needed to add stages in V2)
- Current stages: `new → contacted → qualified → meeting_booked → won → lost`

### Test coverage

```
177 tests · 0 TypeScript errors
├──  75 unit tests  (Vitest, fully mocked dependencies)
└── 102 integration tests  (real PostgreSQL + Redis via Testcontainers)
```

---

## Module 3: Capture Engine

> Full reference: [CAPTURE_MODULE.md](CAPTURE_MODULE.md)

The capture-first module. Leads enter the system through forms, badge scans, and CSV uploads. Every capture method is traceable — every lead record carries its origin (`captureMethod` + `captureSourceId`).

### What's built

**Embeddable form builder**
- `POST /capture/forms` — create a new form (title + field definitions as JSON)
- `GET /capture/forms` — list forms, optionally filtered by `?status=draft|active|archived`
- `GET /capture/forms/:id` — fetch detail (ownership enforced)
- `PATCH /capture/forms/:id` — update fields / config
- `PATCH /capture/forms/:id/publish` — transition `draft → active` (form goes live)
- `PATCH /capture/forms/:id/archive` — transition any status → `archived`
- `DELETE /capture/forms/:id` — only allowed on `draft` forms; active forms return `409`
- Fields stored as JSONB array — supports `text`, `email`, `phone`, `company`, `dropdown`, `checkbox`, `file`
- Optional qualification config: question set + per-question weights → `qualificationScore` on submission

**QR code generation**
- `GET /capture/forms/:id/qr` — returns `{ qrCode: "data:image/png;base64,..." }` PNG data URL
- Encodes `${baseUrl}/f/${formId}` — ready for print, display, email embed

**Public form submission** (no auth required)
- `POST /capture/forms/:id/submit` — entirely public endpoint; no session cookie needed
- Looks up form by ID → validates `status === 'active'` → creates lead under the form owner's `userId`
- Sets `captureMethod = 'form'` and `captureSourceId = formId` on the lead
- Atomically increments `submission_count` on the form record after lead creation
- Draft/archived forms → `404 FORM_NOT_FOUND`
- Blacklisted submitter → `422 BLACKLISTED_LEAD`

**Badge event management**
- `POST /capture/badge-events` — create an event (name + optional date)
- `GET /capture/badge-events` — list events for the user
- `GET /capture/badge-events/:id` — event detail
- `DELETE /capture/badge-events/:id` — delete event + cascade attendees
- `POST /capture/badge-events/:id/attendees` — bulk-upload attendees (email, first/last name, company, job title); duplicate emails within the same event silently skipped (`ON CONFLICT DO NOTHING`)
- `GET /capture/badge-events/:id/attendees` — list attendees sorted by arrival order
- `POST /capture/badge-events/:id/scan/:attendeeId` — scan a badge:
  - Verifies event ownership
  - Checks attendee exists in this event
  - Guards against double-scan → `409 ALREADY_SCANNED`
  - Creates lead under the event owner: `captureMethod = 'badge_scan'`, `captureSourceId = eventId`
  - Stamps `scanned_at` + `lead_id` on the attendee row
  - Returns `{ lead, attendee }`

**CSV import / export**
- `POST /capture/leads/import` — multipart upload; `columnMap` + `dedupMode` as query params
  - `dedupMode=skip` — duplicate emails → skipped counter, no error thrown
  - `dedupMode=overwrite` — duplicate emails → full field overwrite on existing lead
  - `dedupMode=merge` — duplicate emails → only non-empty fields overwrite
  - Blacklisted email during import → skipped (same as `skip` mode)
  - Unexpected errors per row → `failed` counter + `errors[]` array in response
- `GET /capture/leads/export` — streams `text/csv` response with `Content-Disposition: attachment`
  - Exports all leads for the user (up to 10,000 rows)
  - Header row: `email,firstName,lastName,phone,company,jobTitle,status,captureMethod,capturedAt`

### Test coverage

```
101 tests · 0 TypeScript errors
├──  51 unit tests  (Vitest, fully mocked dependencies)
└──  50 integration tests  (real PostgreSQL + Redis via Testcontainers)
```

---

## Roadmap

### Module 4: CRM Integrations *(next)*

| Feature | Description |
|---|---|
| **HubSpot** | OAuth → field mapping → auto-push captured leads as contacts; create deals from qualification data |
| **Salesforce** | OAuth → push as Lead/Contact objects; custom field support |
| **Pipedrive** | OAuth → push as People + Deals |
| **Webhook integration** | Generic outbound webhook with retry logic and delivery logs |
| **Zapier / Make connectors** | No-code workflow compatibility |
| **Two-way sync** | Bidirectional field sync with mapped CRM properties |

---

### Module 5: Lead Enrichment

| Feature | Description |
|---|---|
| **Email verification** | Real-time SMTP validation, catch-all detection, MX record check, disposable email filtering |
| **Company enrichment** | Revenue range, employee count, industry, founding year from public sources |
| **Social profile matching** | Match contact email/name → LinkedIn, Twitter, GitHub profile URL |
| **Decision-maker detection** | Filter by seniority: CEO, CTO, VP, Director |
| **Technology stack detection** | Identify what software/infra a company uses (BuiltWith/Wappalyzer model) |
| **Waterfall enrichment** | Chain multiple data providers; charge only for found data (Clay model) |
| **Periodic re-verification** | Scheduled jobs to re-verify email validity on aging leads |

---

### Module 6: Outreach Engine

| Feature | Description |
|---|---|
| **Cold email sequences** | Multi-step drip campaigns (5–7 touch points) with configurable delays |
| **Smart scheduling** | Send in recipient's timezone at optimal times |
| **A/B testing** | Subject lines, body copy, CTAs, send times |
| **Personalisation** | Dynamic variables `{first_name}`, `{company}`, AI-generated icebreakers |
| **Bounce handling** | Auto-remove hard bounces; smart-manage soft bounces |
| **Unsubscribe management** | CAN-SPAM / GDPR compliant one-click unsubscribe |
| **Email warm-up** | Automated inbox warming to protect sender reputation |
| **Domain rotation** | Multiple sending domains; per-domain limits; blacklist monitoring |
| **Reply management** | AI-powered reply classification: Interested / Not Interested / OOO / DNC |
| **Unified inbox** | All channels (email, LinkedIn DM, SMS) in one threaded view |

---

### Module 7: AI & Intelligence Layer

| Feature | Description |
|---|---|
| **AI Prospect Research** | Given a niche, AI identifies ideal companies and contacts automatically |
| **AI Email Writer** | Generate personalised cold emails from prospect + campaign data |
| **AI Icebreaker Generator** | Pull recent news, posts, job changes for high-signal openers |
| **AI Lead Scoring** | ML model that learns from conversion patterns in the user's own data |
| **Lookalike Audience** | "Find more leads like my best customers" — vector similarity search |
| **AI Campaign Optimizer** | Auto-adjust send times and sequences based on engagement patterns |
| **AI Chatbot for Inbound** | Capture and qualify website visitors in real-time |
| **AI Objection Handling** | Suggested responses drafted from historical reply data |

---

### Module 8: Multi-Tenancy, RBAC & Billing

| Feature | Description |
|---|---|
| **Multi-tenant isolation** | Each customer's data fully isolated at DB level (tenant ID on every table) |
| **RBAC** | Admin / Manager / User roles; per-feature permission flags |
| **Audit logging** | Immutable log of all user actions across the platform |
| **2FA / MFA** | TOTP authenticator app support (upgrade to the auth module) |
| **Subscription tiers** | Starter / Growth / Pro / Agency — enforced at API level |
| **Credit system** | Pay-per-lead, pay-per-verification, pay-per-AI-action |
| **White-label** | Custom branding (logo, colours, domain) for agency resellers |
| **SOC 2 readiness** | Audit trail, encryption at rest, access reviews |

---

## Project Structure

```
src/
├── security/          ✅ Complete (218 tests) — see SECURITY_MODULE.md
│   ├── auth/
│   ├── crypto/
│   ├── db/
│   ├── email/
│   ├── errors/
│   ├── middleware/
│   ├── risk/
│   ├── routes/
│   ├── session/
│   └── users/
├── leads/             ✅ Complete (177 tests) — see LEADS_MODULE.md
│   ├── db/
│   ├── errors/
│   ├── routes/
│   ├── blacklist.repository.ts
│   ├── blacklist.service.ts
│   ├── leads.repository.ts
│   ├── leads.service.ts
│   ├── lists.repository.ts
│   ├── lists.service.ts
│   ├── notes.repository.ts
│   ├── statuses.ts
│   └── tags.repository.ts
└── capture/           ✅ Complete (101 tests) — see CAPTURE_MODULE.md
    ├── db/
    ├── errors/
    ├── routes/
    ├── badge-events.repository.ts
    ├── badge.service.ts
    ├── csv.service.ts
    ├── forms.repository.ts
    ├── forms.service.ts
    └── qr.service.ts

tests/
├── unit/              ✅ 273 tests
├── integration/       ✅ 223 tests
├── e2e/               Playwright specs
└── helpers/           Shared test utilities

drizzle/               SQL migrations
scripts/               DB verification utilities
```

---

## Development Commands

```bash
# Server
npm run dev            # tsx watch — hot reload
npm run build          # tsc compile
npm start              # run compiled build

# Database
npm run db:setup       # docker up + migrate + verify (first-time setup)
npm run db:migrate     # apply pending migrations
npm run db:generate    # generate migration from schema changes
npm run db:studio      # Drizzle visual explorer UI
npm run db:reset       # wipe + recreate (destructive)

# Testing
npm test               # all tests
npm run test:unit      # unit only
npm run test:integration # integration only (requires Docker)
npm run test:e2e       # Playwright
npm run test:coverage  # v8 coverage report

# Quality
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
```

---

## Documentation

| File | Contents |
|---|---|
| [SECURITY_MODULE.md](SECURITY_MODULE.md) | Full architecture, storage schema, crypto, risk engine, logging, API surface |
| [LEADS_MODULE.md](LEADS_MODULE.md) | Leads CRM engine — repositories, services, routes, error hierarchy, test coverage |
| [CAPTURE_MODULE.md](CAPTURE_MODULE.md) | Capture engine — forms, badge events, CSV import/export, QR codes, API surface |
| [MILESTONE_V1_CAPTURE_COMPLETE.md](MILESTONE_V1_CAPTURE_COMPLETE.md) | Milestone record — Phase 3 completion, 496 tests, date and stats |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Full market requirements analysis — competitive landscape, buyer personas, feature matrix |
| [FEATURE_PRIORITY_AND_ARCHITECTURE.md](FEATURE_PRIORITY_AND_ARCHITECTURE.md) | V1 strategy, capture-first philosophy, full V1 feature breakdown |
| [V1_BLUEPRINT.md](V1_BLUEPRINT.md) | Technical blueprint for V1 implementation |
| [DB_SETUP_PLAN.md](DB_SETUP_PLAN.md) | Database setup and migration plan |
