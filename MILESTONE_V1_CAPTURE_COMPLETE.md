# Milestone: V1 Capture Engine Complete

> **Status**: Reached · 496 tests passing · 0 failures · 0 TypeScript errors

---

## What this milestone represents

Three modules of the V1 Lead Generation Platform are now production-ready, built entirely through Test-Driven Development with real database and cache containers in every integration test suite.

| Module | Phase | Tests | Status |
|---|---|---|---|
| Security & Auth | Phase 1 | 218/218 | ✅ |
| Leads CRM Engine | Phase 2 | 177/177 | ✅ |
| Capture Engine | Phase 3 | 101/101 | ✅ |
| **Total** | | **496/496** | ✅ |

---

## Phase 3: Capture Engine — What was built

### Embeddable form builder
- Full form lifecycle management: `draft → active → archived`
- Forms store field definitions as JSONB — supports text, email, phone, company, dropdown, checkbox, file
- Optional qualification config: question set + per-question weights → `qualificationScore` on every submission
- Every status transition enforced: you cannot publish an archived form or delete an active one

### QR code generation
- `GET /capture/forms/:id/qr` returns a PNG data URL (Base64) ready for print, email embed, or display
- Encodes the public-facing form submission URL: `${baseUrl}/f/${formId}`
- No external service dependency — `qrcode` package runs entirely server-side

### Public form submission (no authentication)
- `POST /capture/forms/:id/submit` is the only unauthenticated endpoint in the system
- Resolves form owner from the form record — submitter never provides a `userId`
- Atomically increments `submission_count` on the form row after successful lead creation
- Blacklist check still enforced — a blacklisted email rejected at submission time
- Draft and archived forms return `404` — submitters cannot know a form is being prepared

### Badge event management
- Create named badge events (conferences, trade shows, meetups)
- Bulk-upload attendee lists via JSON: email, first/last name, company, job title
- Duplicate emails within the same event silently skipped (`ON CONFLICT DO NOTHING`)
- Scan a badge: verifies event ownership → guards double-scan (`409 ALREADY_SCANNED`) → creates lead → stamps `scanned_at` and `lead_id` on the attendee row
- Every scanned lead gets `captureMethod = 'badge_scan'` and `captureSourceId = eventId`

### CSV import
- Multipart file upload with `columnMap` for flexible header-to-field mapping
- Three deduplication modes:
  - `skip` — duplicate emails produce a `skipped` count entry, original lead is unchanged
  - `overwrite` — all importable fields replaced on the existing lead
  - `merge` — only non-empty import fields overwrite existing values
- Blacklisted rows counted as skipped (not failed), consistent with form submission behavior
- Per-row errors are collected into `errors[]` and returned with the summary — the import does not abort on partial failure

### CSV export
- `GET /capture/leads/export` returns `Content-Type: text/csv` with `Content-Disposition: attachment`
- Fixed header row: `email,firstName,lastName,phone,company,jobTitle,status,captureMethod,capturedAt`
- Exports all leads for the authenticated user (up to 10,000 rows)

---

## Phase 2: Leads CRM Engine — Summary

Full reference: [LEADS_MODULE.md](LEADS_MODULE.md)

| Feature | What was built |
|---|---|
| Lead capture | `POST /leads` with UTM tracking, capture method, qualification score, custom answers |
| Lead list | Paginated + filtered by `status`, `captureMethod` |
| Lead update | `PATCH /leads/:id` — all fields except email; status validated against `LEAD_STATUSES` |
| Tags | Add/remove per-lead tags — idempotent, no size limit |
| Notes | Append freeform notes with `createdBy` attribution; list in creation order |
| Static lists | Create/rename/delete named segments; bulk-add/remove leads |
| Blacklist | Email and domain blacklist; enforced at every capture path |
| Status pipeline | `new → contacted → qualified → meeting_booked → won → lost` |
| Deduplication | `409 DUPLICATE_LEAD` on duplicate email per user; unique constraint at DB level |

---

## Phase 1: Security & Auth — Summary

Full reference: [SECURITY_MODULE.md](SECURITY_MODULE.md)

| Feature | Implementation |
|---|---|
| Password hashing | Argon2id with HMAC-SHA256 server-side pepper |
| Session management | Cryptographically random session IDs stored in Redis with sliding expiry |
| Email verification | HMAC-signed 6-digit codes; single-use enforced via Redis key deletion |
| Password reset | Secure multi-step token flow with short TTL |
| Risk engine | Per-request score: failed attempts + impossible travel + device fingerprint + IP reputation |
| Rate limiting | Per-IP and per-user limiters with Redis counters; separate configs per endpoint |
| Session cookie | `HttpOnly`, `Secure`, `SameSite=Strict`; domain-scoped |

---

## Technical decisions made in Phase 3

### `LEAD_STATUSES as const` in `src/leads/statuses.ts`
Statuses are an `as const` array — not a database enum. Adding a new pipeline stage in V2 requires a single file change and a permissive `ALTER TABLE ... ADD ... CHECK` migration pattern, not a `DROP TYPE` + rebuild cycle.

### Public submit endpoint breaks auth middleware symmetry intentionally
The `auth.routes.ts` pattern wraps all routes with `requireAuth`. The capture router registers the submit endpoint **before** calling `fastify.addHook('preHandler', requireAuth)`, meaning it is the only route in the entire system accessible without a session. This is by design — form submissions come from anonymous end-users, never from authenticated accounts.

### `@fastify/multipart` pinned to v8
`@fastify/multipart` v9+ targets Fastify 5. This project is on Fastify 4. v8 is the correct release line.

### CSV dedup `merge` mode does not merge arrays (tags)
CSV rows contain scalar fields. Tags are imported as a string that maps to the `tags` column. In `merge` mode, if a CSV row provides a non-empty `tags` value it replaces the existing tags string; if blank, it leaves the existing value unchanged. Full tag-set merge is a V2 concern if custom merge strategies are added.

### Badge scan atomicity
`scanAttendee` in `badge-events.repository.ts` performs two writes in sequence (stamp `scanned_at` on the attendee row, create lead). These are not wrapped in a transaction in Phase 3. If lead creation fails after the stamp, the attendee will show `scanned_at` but have no `lead_id`. This is an acceptable V1 trade-off — a retry scan will fail with `409 ALREADY_SCANNED` and the operator can manually link the lead. Full transactional wrapping is tracked for V2.

### `incrementSubmissionCount` uses raw SQL `+1`
```sql
UPDATE forms SET submission_count = submission_count + 1 WHERE id = $1
```
This is an atomic increment at the database level. No application-level read-modify-write. Concurrent form submissions at high volume will not cause count skew.

---

## New packages added in Phase 3

| Package | Purpose |
|---|---|
| `qrcode` | Server-side QR code generation → PNG data URL |
| `csv-parse` | Streaming CSV parser for import |
| `csv-stringify` | CSV serializer for export |
| `@fastify/multipart@8` | Multipart form data handler (Fastify 4 compatible) |

---

## Files created in Phase 3

```
src/leads/
└── statuses.ts                        Lead status constant + type

src/capture/
├── errors/
│   └── index.ts                       6 error classes (CaptureError base)
├── routes/
│   └── capture.routes.ts              18 endpoints
├── badge-events.repository.ts         8 methods
├── badge.service.ts                   7 methods
├── csv.service.ts                     importLeads + exportLeads
├── forms.repository.ts                8 methods
├── forms.service.ts                   8 methods
└── qr.service.ts                      generateQrCode

tests/unit/capture/
├── badge.service.test.ts              15 tests
├── csv.service.test.ts                12 tests
├── forms.service.test.ts              20 tests
└── qr.service.test.ts                  4 tests

tests/integration/
├── badge-events.repository.test.ts    ~25 tests
├── capture.routes.test.ts             24 tests
└── forms.repository.test.ts          ~25 tests
```

**Modified files (Phase 3 additions):**
- `src/leads/leads.service.ts` — added `findLeadByEmail(userId, email)` for CSV overwrite/merge
- `package.json` — added 4 new packages

---

## Test counts at milestone

```
npx vitest run

 ✓  tests/unit/crypto/...          12 tests
 ✓  tests/unit/auth/...            56 tests
 ✓  tests/unit/session/...         21 tests
 ✓  tests/unit/risk/...            58 tests
 ✓  tests/unit/leads/...           75 tests
 ✓  tests/unit/capture/...         51 tests
 ✓  tests/integration/...         223 tests
─────────────────────────────────────────
 Tests  496 passed (496)
 Duration  ~45s
```

---

## Next milestone: Module 4 — CRM Integrations

The capture infrastructure is in place. The next module connects outbound integrations:

- **HubSpot / Salesforce / Pipedrive sync** — push captured leads to external CRMs on a schedule or webhook trigger
- **Webhook delivery** — POST full lead payload to user-configured URLs on capture events
- **Zapier / Make compatibility** — standardized webhook format with retry and delivery log
- **Field mapping UI** — map internal lead fields to destination CRM field names per integration

> Starting point: `POST /integrations` to register a connection, `POST /integrations/:id/sync` to trigger a manual push.
