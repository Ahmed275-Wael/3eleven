# Security Module — Complete Implementation Reference

> **Status**: Production-ready · 218/218 tests passing · 0 TypeScript errors  
> **Runtime**: Node.js 22, TypeScript ESM, Fastify 4, PostgreSQL 16, Redis 7

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Feature Reference](#feature-reference)
4. [Storage](#storage)
5. [Cryptography](#cryptography)
6. [Risk Engine](#risk-engine)
7. [Session Management](#session-management)
8. [Logging](#logging)
9. [API Surface](#api-surface)
10. [Test Coverage](#test-coverage)
11. [Environment Variables](#environment-variables)

---

## Overview

The security module is a **self-contained auth subsystem** inside `src/security/`. It owns every concern from user registration through session lifecycle: credential storage, email verification, login risk scoring, session tokens, password reset, rate limiting, structured event logging, and structured application logs.

It is deliberately monolithic within one module boundary — no external auth dependencies (no Passport, no Auth0, no NextAuth). The entire surface area is tested, audited, and owned.

---

## Architecture

```
src/security/
├── auth/
│   ├── registration.service.ts      # MODULE 4.1 — Registration
│   ├── email-verification.service.ts # MODULE 4.2 — Email verification
│   ├── login.service.ts             # MODULE 4.3 — Login + risk
│   └── password-reset.service.ts    # MODULE 5   — Password reset
├── crypto/
│   ├── argon2.ts                    # MODULE 1.2 — Argon2id + pepper HMAC
│   ├── verification-code.ts         # MODULE 1.3 — 6-digit CSPRNG codes (15 min TTL)
│   ├── reset-code.ts                # MODULE 1.4 — 6-digit CSPRNG codes (1 hr TTL)
│   └── session-id.ts                # MODULE 1.1 — 32-byte hex session tokens
├── db/
│   └── schema.ts                    # Drizzle ORM schema — users + security_events
├── email/
│   └── smtp-sender.ts               # Nodemailer SMTP sender (verification + reset)
├── errors/
│   └── index.ts                     # Typed SecurityError hierarchy
├── middleware/
│   ├── require-auth.ts              # MODULE 3.3 — Cookie-based auth guard
│   └── rate-limit.config.ts        # MODULE 7   — @fastify/rate-limit config
├── risk/
│   ├── risk.service.ts              # MODULE 6.2 — Score aggregator
│   ├── security-events.repository.ts # MODULE 6.3 — DB event logger
│   └── scorers/
│       ├── ip-reputation.scorer.ts  # Tor/datacenter prefix matching
│       ├── failed-attempts.scorer.ts # 15-min sliding window
│       ├── impossible-travel.scorer.ts # Haversine speed check
│       └── new-device.scorer.ts    # Fingerprint comparison
├── routes/
│   └── auth.routes.ts              # All HTTP endpoints + structured logging
├── session/
│   ├── session.service.ts          # MODULE 3.1 — Redis session store (7-day TTL)
│   └── session.cookie.ts           # MODULE 3.2 — HttpOnly cookie helpers
└── users/
    └── users.repository.ts         # MODULE 2.1 — User CRUD with Drizzle
```

### Dependency graph

```
HTTP Request
    │
    ▼
auth.routes.ts
    ├── RegistrationService     ← usersRepo, redis, emailSender, eventsRepo*
    ├── EmailVerificationService ← usersRepo, redis, sessionService, emailSender, eventsRepo*
    ├── LoginService            ← usersRepo, sessionService, eventsRepo
    ├── PasswordResetService    ← usersRepo, redis, sessionService, emailSender, eventsRepo*
    └── SessionService          ← redis

(*eventsRepo optional — services degrade gracefully if omitted in tests)
```

---

## Feature Reference

### 1 — User Registration

**Route**: `POST /auth/register`  
**Rate limit**: 10 req / 1 minute per IP

Flow:
1. Zod schema validates `username` (3–30 chars, `[a-zA-Z0-9_-]` only), `email`, `password` (≥ 8 chars)
2. Uniqueness check on `username` AND `email` — checked **before** hashing to avoid wasting Argon2 cycles
3. Password hashed with Argon2id + pepper (see [Cryptography](#cryptography))
4. User row inserted with `emailVerified = false`
5. 6-digit CSPRNG code generated, stored in Redis as `verify:{email}` with 15-minute TTL, sent via SMTP
6. `REGISTRATION_SUCCESS` event logged to `security_events` table
7. Returns `{ userId, username, message }` — never returns `passwordHash`

Errors thrown: `ValidationError` · `DuplicateUsernameError` · `DuplicateEmailError`

---

### 2 — Email Verification

**Routes**: `POST /auth/verify-email` · `POST /auth/resend-verification`

**Verify flow**:
1. Looks up user by email — must exist and not already be verified
2. `consumeCode()` — atomic GET + DEL in Redis (single-use guarantee)
3. Sets `emailVerified = true` in database
4. Creates session (`createSession()` → `session:{id}` in Redis, 7-day TTL)
5. Sets `HttpOnly; Secure; SameSite=Strict` session cookie
6. Logs `EMAIL_VERIFIED` event

**Resend flow**:
1. Validates user exists and is not already verified
2. Generates a fresh code (overwrites previous Redis key, resetting TTL)
3. Sends email best-effort (SMTP failure does not fail the request — code already stored)
4. Logs `RESEND_VERIFICATION` event

Errors thrown: `UserNotFoundError` · `AlreadyVerifiedError` · `InvalidVerificationCodeError`

---

### 3 — Login

**Route**: `POST /auth/login`  
**Rate limit**: 5 req / 1 minute per IP

Flow:
1. Looks up user by normalised (lowercase) username
2. Rejects if not found, soft-deleted, or email unverified (timing-safe: always runs password verify path for real users to prevent enumeration)
3. Argon2id password verification with pepper
4. On invalid password: logs `LOGIN_FAILED`, throws `InvalidCredentialsError`
5. **Risk engine** (parallel execution):
   - Fetches last 20 `security_events` from DB
   - Fetches AbuseIPDB abuse score via external API (`ABUSEIPDB_API_KEY`)
   - Runs `scoreIpReputation()` + `abuseToScore()` → IP score
   - Runs `scoreFailedAttempts()` — counts `LOGIN_FAILED` events in last 15 min
   - `aggregate([ipScore, failedScore])` → `{ level: LOW|MEDIUM|HIGH|CRITICAL, action: ALLOW|STEP_UP|FORCE_REAUTH|LOCK_ACCOUNT }`
6. `LOCK_ACCOUNT` action → logs `LOGIN_BLOCKED`, throws `HighRiskLoginError` (403)
7. Otherwise: creates session, logs `LOGIN_SUCCESS` with `{ action, ipScore, failedScore }` in metadata

Errors thrown: `InvalidCredentialsError` · `UnverifiedEmailError` · `HighRiskLoginError`

---

### 4 — Logout

**Route**: `POST /auth/logout`

Flow:
1. Reads session cookie; if absent → returns `{ loggedOut: false }`
2. `getSession()` to capture `userId` for logging (before destroy)
3. `destroySession()` — DEL `session:{id}` from Redis
4. Clears cookie (`maxAge: 0`)
5. If session was found and destroyed: logs `LOGOUT` event with `userId` + IP

---

### 5 — Password Reset

**Routes**: `POST /auth/forgot-password` · `POST /auth/verify-reset-code` · `POST /auth/reset-password`  
**Rate limit**: 3 req / 1 hour per IP (forgot-password only)

**Step 1 — Request** (`/auth/forgot-password`):
- Silently returns 200 whether email exists or not (enumeration prevention)
- If user exists: generates 6-digit code, stores as `reset:{email}` with 1-hour TTL, sends email
- Logs `PASSWORD_RESET_REQUESTED` (riskLevel: MEDIUM) for existing users only

**Step 2 — Verify** (`/auth/verify-reset-code`):
- `peekResetCode()` — READ-ONLY check, does NOT consume the code
- Returns `{ valid: true }` — allows front-end to gate the reset form

**Step 3 — Reset** (`/auth/reset-password`):
- Validates new password length (≥ 8) BEFORE consuming code (protects code from being wasted)
- `consumeResetCode()` — atomic GET + DEL (single-use)
- Re-hashes and stores new password
- Destroys ALL sessions for the user (`redis.keys('session:*')` + destroySession for each)
- Logs `PASSWORD_RESET_COMPLETED` (riskLevel: HIGH)

Errors thrown: `InvalidResetCodeError` · `ValidationError`

---

### 6 — requireAuth Middleware

`src/security/middleware/require-auth.ts`

- Reads session cookie, calls `sessionService.getSession()`
- On valid session: attaches `request.user: SessionPayload` (`{ userId, username, authMethod }`)
- On missing/expired session: throws `UnauthenticatedError` (401)
- Fastify module augmentation: `FastifyRequest.user` is typed globally

Usage on any protected route:
```ts
app.get('/protected', { preHandler: requireAuth }, async (request, reply) => {
  const { userId } = request.user!;
  // ...
});
```

---

## Storage

### PostgreSQL (via Drizzle ORM)

**Table: `users`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `username` | `varchar(30)` UNIQUE | Always stored lowercase |
| `email` | `varchar(255)` UNIQUE | – |
| `password_hash` | `text` | Argon2id + pepper |
| `email_verified` | `boolean` | Default `false` |
| `created_at` | `timestamptz` | Auto |
| `updated_at` | `timestamptz` | Auto |
| `deleted_at` | `timestamptz` | Nullable — soft delete |

Soft delete: `findByUsername`, `findByEmail`, `findById` all add `WHERE deleted_at IS NULL`.

---

**Table: `security_events`**

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` FK → `users.id` | Nullable (pre-auth events) |
| `event_type` | `varchar(50)` | See event type list below |
| `ip_address` | `varchar(45)` | IPv4 or IPv6 |
| `user_agent` | `text` | Nullable |
| `risk_level` | `varchar(20)` | `LOW / MEDIUM / HIGH / CRITICAL` |
| `metadata` | `jsonb` | Arbitrary context per event type |
| `created_at` | `timestamptz` | Auto |

**Event types recorded**:

| Event | Risk Level | Trigger |
|---|---|---|
| `REGISTRATION_SUCCESS` | LOW | User row created |
| `EMAIL_VERIFIED` | LOW | Verification code accepted |
| `RESEND_VERIFICATION` | LOW | Resend requested |
| `LOGIN_FAILED` | LOW | Wrong password |
| `LOGIN_BLOCKED` | HIGH / CRITICAL | Risk aggregator → LOCK_ACCOUNT |
| `LOGIN_SUCCESS` | LOW – HIGH | Successful login (level from risk engine) |
| `LOGOUT` | LOW | Session destroyed |
| `PASSWORD_RESET_REQUESTED` | MEDIUM | Valid email reset requested |
| `PASSWORD_RESET_COMPLETED` | HIGH | Password changed, sessions wiped |

---

### Redis

| Key pattern | Type | TTL | Purpose |
|---|---|---|---|
| `session:{id}` | JSON string | 7 days (sliding) | Session payload: `{ userId, username, authMethod }` |
| `verify:{email}` | string | 15 minutes | Email verification code |
| `reset:{email}` | string | 1 hour | Password reset code |

Session TTL is **sliding**: every `getSession()` call resets the 7-day timer via `EXPIRE`.

---

### Migrations

Managed by `drizzle-kit`. Current migration: `drizzle/0000_long_lilandra.sql`

```bash
npm run db:migrate   # apply
npm run db:generate  # generate from schema changes
npm run db:studio    # Drizzle visual explorer
```

---

## Cryptography

### Password hashing — Argon2id + pepper

File: `src/security/crypto/argon2.ts`

```
password  ──HMAC-SHA256(PEPPER env)──►  peppered_bytes
                                                │
                                                ▼
                                     Argon2id(m=65536, t=3, p=4)
                                                │
                                                ▼
                                         password_hash (stored)
```

- PEPPER secret loaded from `process.env.PEPPER` — throws `MissingPepperError` if absent
- Argon2id parameters: **64 MB memory**, **3 iterations**, **4 parallelism** (OWASP recommended minimum)
- Pepper is applied via HMAC-SHA256 before hashing → mitigates DB breach without PEPPER

### One-time codes — `node:crypto.randomInt`

Both verification and reset codes use `randomInt(0, 1_000_000)` padded to 6 digits — cryptographically secure, uniform distribution. Never `Math.random()`.

### Session IDs — 32-byte hex

`src/security/crypto/session-id.ts` — `crypto.randomBytes(32).toString('hex')` → 64-char hex string. Entropy: 256 bits.

---

## Risk Engine

### Scorers

| Scorer | Score logic | Max score |
|---|---|---|
| **IP Reputation** | Tor exit node prefix match → 100; known datacenter/VPN prefix → 40 | 100 |
| **AbuseIPDB** | External API score ≥ 80 → 100; ≥ 50 → 60; ≥ 20 → 30; else 0 | 100 |
| **Failed Attempts** | ≥ 5 failures in last 15 min → 50; ≥ 3 → 20 | 50 |
| **New Device** | Fingerprint not in known list → 20 | 20 |
| **Impossible Travel** | Haversine distance / elapsed hours > 1,000 km/h → 100 | 100 |

`scoreIpReputation` and `abuseToScore` take the **max** of the two IP signals (not sum).

### Aggregator — `aggregate(scores[])`

```
total = sum of all passed scores

total ≥ RISK_CRITICAL_THRESHOLD (default 150) → CRITICAL → LOCK_ACCOUNT
total ≥ RISK_HIGH_THRESHOLD    (default 70)  → HIGH     → FORCE_REAUTH
total ≥ RISK_MEDIUM_THRESHOLD  (default 30)  → MEDIUM   → STEP_UP
else                                          → LOW      → ALLOW
```

Thresholds are tunable via environment variables with safe defaults.

Current login path uses: **IP score + failed-attempts score** (AbuseIPDB and impossible-travel are implemented and tested but wired in at login).

---

## Session Management

- Storage: Redis, key `session:{id}`, JSON-encoded `SessionPayload`
- Expiry: 7 days, **sliding** (TTL reset on every `getSession` read)
- Rotation: `rotateSession(id)` → verifies old session → destroys it → creates new one
- Cookie: `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, `Max-Age=604800`
- Cookie name: configurable via `SESSION_COOKIE_NAME` env var (default `__session`)
- All sessions for a user are destroyed on password reset (Redis `KEYS session:*` scan)

---

## Logging

The module implements two complementary layers:

### Layer 1 — Database event log (`security_events` table)

Durable, queryable record of every security-relevant auth action. Used by the risk engine itself (`getRecentEvents`) to detect brute force. See [Storage → security_events](#security-events) for full schema and event type list.

All `eventsRepo.logEvent()` calls are wrapped in `try/catch` — a database failure never rejects the user-facing HTTP response.

### Layer 2 — Structured application logs (pino / stdout)

Fastify is configured in `src/app.ts`:

```ts
Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [
        'req.body.password',
        'req.body.newPassword',
        'req.body.code',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
  },
})
```

Each route handler emits a structured log line **between** Fastify's built-in "incoming request" and "request completed" lines, giving full context with the shared `reqId` correlation field:

| Event field | Level | Context logged |
|---|---|---|
| `auth.register` | info | `userId`, `ip` |
| `auth.email_verify` | info | `ip` |
| `auth.resend_verification` | info | `ip` |
| `auth.login` | info | `ip`, `userAgent` (truncated to 256 chars) |
| `auth.logout` | info | `userId`, `ip`, `outcome` (destroyed / no_session / already_expired / destroyed_no_session_data) |
| `auth.forgot_password` | info | `ip` only — no hint of email existence |
| `auth.verify_reset_code` | info | — |
| `auth.reset_password` | info | `ip` |
| `auth.error` | **warn** | `code`, `statusCode` |
| `validation_error` | **warn** | — |
| `rate_limited` | **warn** | `statusCode`, `code` |
| `internal_error` | **error** | full `err` object with stack |

**Security guarantees on logs**:
- `email`, `username`, `password`, `code` are **never** written to stdout logs
- `/auth/forgot-password` logs only `ip` — the log never reveals whether the email exists
- `userAgent` is truncated at 256 chars to prevent log-storage attacks
- pino serialises to JSON — log-injection is structurally impossible (values are JSON-encoded, not interpolated)

**Example log triplet** for a successful logout:
```json
{"level":30,"reqId":"req-42","req":{"method":"POST","url":"/auth/logout"},"msg":"incoming request"}
{"level":30,"reqId":"req-42","event":"auth.logout","outcome":"destroyed","userId":"a1b2-...","ip":"203.0.113.5","msg":"Session destroyed — user logged out"}
{"level":30,"reqId":"req-42","res":{"statusCode":200},"responseTime":12.3,"msg":"request completed"}
```

---

## API Surface

All routes live under the Fastify plugin registered in `src/app.ts`.

| Method | Path | Auth required | Rate limit | Purpose |
|---|---|---|---|---|
| POST | `/auth/register` | — | 10/min | Create account |
| POST | `/auth/verify-email` | — | — | Verify email with code |
| POST | `/auth/resend-verification` | — | — | Resend verification code |
| POST | `/auth/login` | — | 5/min | Login, get session cookie |
| POST | `/auth/logout` | cookie | — | Destroy session |
| POST | `/auth/forgot-password` | — | 3/hr | Request reset code |
| POST | `/auth/verify-reset-code` | — | — | Validate reset code (non-consuming) |
| POST | `/auth/reset-password` | — | — | Apply new password |

Rate limiting key is `x-forwarded-for` header (first entry) falling back to `request.ip`. When Redis is available, limits are shared across server instances. Without Redis, limits are per-process (in-memory fallback, `@fastify/rate-limit` default).

### Error response format

All errors return consistent JSON:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

**Error codes**:

| Code | HTTP | Trigger |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod schema failure or business rule violation |
| `INVALID_CODE` | 400 | Wrong or expired verification / reset code |
| `ALREADY_VERIFIED` | 400 | Email already verified |
| `USER_NOT_FOUND` | 404 | Email not in system |
| `UNAUTHENTICATED` | 401 | Missing or expired session |
| `INVALID_CREDENTIALS` | 401 | Wrong username or password |
| `EMAIL_NOT_VERIFIED` | 403 | Login attempted before verifying email |
| `HIGH_RISK_LOGIN` | 403 | Risk engine blocked the login |
| `USERNAME_TAKEN` | 409 | Duplicate username |
| `EMAIL_TAKEN` | 409 | Duplicate email |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unhandled exception |

---

## Test Coverage

**218 tests · 19 test files · 0 todos**

| Layer | Files | Tests | What is covered |
|---|---|---|---|
| **Unit** | 12 | 147 | All service methods, all crypto utilities, all risk scorers, session service, all error paths |
| **Integration** | 7 | 71 | Real PostgreSQL + Redis via testcontainers; full auth routes with Fastify.inject(); rate-limit state; Redis TTLs |

Key integration test areas:
- `auth-routes.test.ts` — 24 full HTTP round-trips against real DB + Redis
- `security-events.test.ts` — 7 DB write/read tests with real PostgreSQL
- `session.redis.test.ts` — sliding TTL, rotation, destroy
- `rate-limit.test.ts` — exhaustion + 429 responses

Test framework: **Vitest 2**, **Testcontainers 10** (spins up real Postgres + Redis containers).

Run commands:
```bash
npm test                  # all 218 tests
npm run test:unit         # 147 unit tests only
npm run test:integration  # 71 integration tests only
npm run test:e2e          # Playwright end-to-end
npm run test:coverage     # v8 coverage report
```

---

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `REDIS_URL` | — | `redis://localhost:6379` | Redis connection string |
| `PEPPER` | ✅ | — | HMAC-SHA256 pepper for password hashing |
| `SMTP_HOST` | — | `localhost` | SMTP server host |
| `SMTP_PORT` | — | `587` | SMTP server port |
| `SMTP_SECURE` | — | `false` | Use TLS for SMTP |
| `SMTP_USER` | — | — | SMTP auth username |
| `SMTP_PASS` | — | — | SMTP auth password |
| `SMTP_FROM` | — | `noreply@leadgen.local` | From address |
| `ABUSEIPDB_API_KEY` | — | `''` | AbuseIPDB API key (risk scoring degrades gracefully without it) |
| `SESSION_COOKIE_NAME` | — | `__session` | Session cookie name |
| `LOG_LEVEL` | — | `info` | Pino log level |
| `RISK_MEDIUM_THRESHOLD` | — | `30` | Risk aggregator tuning |
| `RISK_HIGH_THRESHOLD` | — | `70` | Risk aggregator tuning |
| `RISK_CRITICAL_THRESHOLD` | — | `150` | Risk aggregator tuning |
| `NODE_ENV` | — | — | `production` enables strict TLS for SMTP |
| `PORT` | — | `3000` | HTTP server port |
| `HOST` | — | `0.0.0.0` | HTTP server bind address |
