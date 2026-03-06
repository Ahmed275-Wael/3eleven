# V1 Security Module — TDD Implementation Plan

> **Auth Strategy**: Username + Password only. Email reachability verified via 6-digit code before account is activated.
> Google OAuth, PKCE, MFA, and Passkeys all deferred to V2+.
> Every line of production code is preceded by a failing test.

---

## Auth Stack — V1 Scope

```
REGISTRATION:
  1. POST /auth/register { username, email, password }
     → validate inputs
     → hash password (Argon2id + pepper)
     → insert user (unverified)
     → generate 6-digit code, store in Redis (15min TTL)
     → send code to email
  2. POST /auth/verify-email { email, code }
     → validate code
     → mark account as verified
     → user can now log in

LOGIN:      username (case-insensitive) + password
            → unverified accounts cannot log in

FORGOT PW:  email → 6-digit reset code (not a link) → new password

SESSIONS:   Redis server-side, 256-bit ID, HttpOnly + Secure + SameSite=Strict

DEFERRED:
  - Google OAuth          → V2
  - PKCE                  → V2
  - MFA / TOTP            → V2
  - Recovery codes        → V2
  - Passkeys              → V2
  - GitHub OAuth          → V2
```

---

## Tools

| Layer | Tool |
|---|---|
| Unit + Integration runner | `vitest` |
| Test DB + Redis | `testcontainers` (real Docker instances, not mocks) |
| E2E browser | `playwright` |
| Coverage | `@vitest/coverage-v8` (target ≥ 90% on src/security/) |
| HTTP route testing | `fastify.inject()` (no real network) |
| Mocking | `vitest` built-ins (`vi.mock`, `vi.spyOn`) |
| Email mock | `nodemailer` + `smtp-server` (in-process fake SMTP, captures outbound emails) |

---

## Test Directory Layout

```
tests/
├── unit/
│   ├── crypto/
│   │   ├── session-id.test.ts
│   │   ├── argon2.test.ts
│   │   ├── verification-code.test.ts
│   │   └── reset-code.test.ts
│   ├── auth/
│   │   ├── registration.test.ts
│   │   ├── email-verification.test.ts
│   │   ├── login.test.ts
│   │   └── password-reset.test.ts
│   ├── session/
│   │   └── session.service.test.ts
│   └── risk/
│       ├── scorers.test.ts
│       └── risk-aggregator.test.ts
├── integration/
│   ├── users.repository.test.ts
│   ├── verification.redis.test.ts
│   ├── reset-code.redis.test.ts
│   ├── session.redis.test.ts
│   └── rate-limit.test.ts
├── e2e/
│   ├── registration-and-verify.spec.ts
│   ├── email-unreachable.spec.ts
│   ├── login.spec.ts
│   ├── password-reset.spec.ts
│   ├── session-expiry.spec.ts
│   └── rate-limit.spec.ts
└── manual/
    └── REAL_EMAIL_DELIVERY.md
```

---

## Implementation Order — Top to Bottom

---

### MODULE 1 — Cryptographic Primitives
> Foundation. No I/O. All pure functions. Test to 100%.

---

#### 1.1 — Session ID Generator

**File**: `src/security/crypto/session-id.ts`

```
[ FAIL ] generates 32 bytes (256-bit)
[ FAIL ] output is base64url string (no +, /, = characters)
[ FAIL ] output is exactly 43 characters
[ FAIL ] 10,000 iterations → no two IDs are identical
─── implement generateSessionId() using crypto.randomBytes(32) ───
[ PASS ] all
```

---

#### 1.2 — Argon2id Password Hasher

**File**: `src/security/crypto/argon2.ts`

```
[ FAIL ] hashPassword(plain) returns a string, never the plain text
[ FAIL ] PEPPER env var missing at module load → throws MissingPepperError immediately (fail-fast)
[ FAIL ] hashPassword() applies HMAC-SHA256(password, PEPPER) before argon2id
[ FAIL ] hashPassword() uses params: m=65536, t=3, p=4
[ FAIL ] verifyPassword(plain, hash) → true for correct password
[ FAIL ] verifyPassword(plain, hash) → false for wrong password
[ FAIL ] verifyPassword() applies same pepper before verifying
[ FAIL ] two calls to hashPassword() with same input → different hashes (unique salt per call)
─── implement hashPassword(), verifyPassword() ───
[ PASS ] all
```

---

#### 1.3 — Email Verification Code

**File**: `src/security/crypto/verification-code.ts`

```
[ FAIL ] generateCode() returns exactly 6 numeric digits as a string (zero-padded e.g. "047382")
[ FAIL ] code stored in Redis under verify:{email} with 15-minute TTL
[ FAIL ] consumeCode(email, code) retrieves and deletes atomically (single-use)
[ FAIL ] consumeCode() with correct code → returns true, key deleted from Redis
[ FAIL ] consumeCode() with wrong code → returns false, key NOT deleted (user can retry)
[ FAIL ] consumeCode() after TTL elapsed → returns false
[ FAIL ] consumeCode() after already-consumed → returns false (key gone)
[ FAIL ] generating a new code for same email overwrites the old one in Redis
[ FAIL ] 10,000 generated codes → all are strings of exactly 6 digits 0–9
─── implement generateCode(), consumeCode() ───
[ PASS ] all
```

---

#### 1.4 — Password Reset Code

**File**: `src/security/crypto/reset-code.ts`

```
[ FAIL ] generateResetCode() returns exactly 6 numeric digits as a string
[ FAIL ] code stored in Redis under reset:{email} with 1-hour TTL
[ FAIL ] consumeResetCode(email, code) → correct code → true, key deleted
[ FAIL ] consumeResetCode() → wrong code → false, key preserved (user can retry)
[ FAIL ] consumeResetCode() → expired → false
[ FAIL ] consumeResetCode() → already consumed → false
[ FAIL ] generating new reset code for same email overwrites old one
─── implement generateResetCode(), consumeResetCode() ───
[ PASS ] all
```

---

### MODULE 2 — Data Layer (Repositories)
> Real PostgreSQL via testcontainers. No mocking the DB.

---

#### 2.1 — User Repository

**File**: `src/security/users/users.repository.ts`

```
[ FAIL ] createUser({ username, email, passwordHash }) → inserts row, returns { id, username, email, createdAt }
[ FAIL ] newly created user has emailVerified = false by default
[ FAIL ] findByUsername(username) → returns user or null (case-insensitive)
[ FAIL ] findByEmail(email) → returns user or null
[ FAIL ] findById(id) → returns user or null
[ FAIL ] duplicate username → throws DuplicateUsernameError
[ FAIL ] duplicate email → throws DuplicateEmailError
[ FAIL ] username always stored lowercase
[ FAIL ] setEmailVerified(userId) → sets emailVerified = true
[ FAIL ] updatePasswordHash(userId, newHash) → updates column
[ FAIL ] softDelete(userId) → sets deleted_at timestamp
[ FAIL ] findByUsername() excludes soft-deleted users
[ FAIL ] findByEmail() excludes soft-deleted users
[ FAIL ] findById() excludes soft-deleted users
─── implement all repository methods ───
[ PASS ] all
```

---

### MODULE 3 — Session Management

---

#### 3.1 — Session Service (Unit)

**File**: `src/security/session/session.service.ts`

```
[ FAIL ] createSession(payload) stores payload in Redis under session:{id} key
[ FAIL ] createSession() returns the sessionId (string)
[ FAIL ] getSession(id) retrieves and deserializes the stored payload
[ FAIL ] getSession() on non-existent key → returns null
[ FAIL ] destroySession(id) deletes the Redis key
[ FAIL ] rotateSession(id) → deletes old key, creates new key with same payload + fresh TTL, returns new id
[ FAIL ] session TTL on creation is exactly 7 days (604800 seconds)
[ FAIL ] getSession() call extends TTL by 7 days (sliding expiry via EXPIRE reset)
─── implement session.service.ts ───
[ PASS ] all
```

**Integration** (real Redis via testcontainer):
```
[ FAIL ] createSession → getSession round-trip returns same payload
[ FAIL ] TTL is set and readable via Redis TTL command
[ FAIL ] destroySession → getSession returns null
[ FAIL ] session expired after TTL → getSession returns null
─── no new code, validates real Redis behavior ───
[ PASS ] all
```

---

#### 3.2 — Session Cookie Helpers

**File**: `src/security/session/session.cookie.ts`

```
[ FAIL ] setSessionCookie() sets HttpOnly flag
[ FAIL ] setSessionCookie() sets Secure flag
[ FAIL ] setSessionCookie() sets SameSite=Strict
[ FAIL ] setSessionCookie() sets cookie name from SESSION_COOKIE_NAME config constant
[ FAIL ] setSessionCookie() sets Max-Age to 7 days
[ FAIL ] clearSessionCookie() sets same cookie with Max-Age=0 and empty value
─── implement setSessionCookie(), clearSessionCookie() ───
[ PASS ] all
```

---

#### 3.3 — requireAuth Middleware

**File**: `src/security/middleware/require-auth.ts`

```
[ FAIL ] valid cookie + active Redis session → req.user populated, calls next()
[ FAIL ] missing cookie → replies 401 { code: 'UNAUTHENTICATED' }
[ FAIL ] cookie present but no matching Redis key (expired/destroyed) → replies 401
[ FAIL ] cookie present, session valid, but user is soft-deleted in DB → replies 401
[ FAIL ] cookie present, session valid → does NOT extend TTL on failed user lookup
─── implement requireAuth Fastify preHandler ───
[ PASS ] all
```

---

### MODULE 4 — Username + Password Auth

---

#### 4.1 — Registration

**File**: `src/security/auth/registration.service.ts`

```
[ FAIL ] register({ username, email, password }) → hashes password via argon2.ts → inserts user row
[ FAIL ] returns { userId, username, email } on success
[ FAIL ] duplicate username → throws DuplicateUsernameError (no password hash computed yet — check first)
[ FAIL ] duplicate email → throws DuplicateEmailError
[ FAIL ] username < 3 chars → throws ValidationError
[ FAIL ] username > 30 chars → throws ValidationError
[ FAIL ] username contains spaces or special chars (only a-z 0-9 _ - allowed) → throws ValidationError
[ FAIL ] password < 8 chars → throws ValidationError
[ FAIL ] after successful insert → sendVerificationCode(email) called (6-digit code stored in Redis, emailed)
[ FAIL ] sendVerificationCode failure → user row still created (email is best-effort, not transactional)
[ FAIL ] register() does NOT create a session (user must verify email before logging in)
─── implement registration.service.ts ───
[ PASS ] all
```

**Registration Route**:
```
[ FAIL ] POST /auth/register → body: { username, email, password } → 201 { userId, username, message: 'Check your email for a verification code' }
[ FAIL ] POST /auth/register → duplicate username → 409 { code: 'USERNAME_TAKEN' }
[ FAIL ] POST /auth/register → duplicate email → 409 { code: 'EMAIL_TAKEN' }
[ FAIL ] POST /auth/register → invalid body → 400 { code: 'VALIDATION_ERROR', fields: [...] }
[ FAIL ] POST /auth/register → does NOT return passwordHash in response (ever)
─── implement routes/auth.routes.ts ───
[ PASS ] all
```

---

#### 4.2 — Email Verification

**File**: `src/security/auth/email-verification.service.ts`

```
[ FAIL ] verifyEmail({ email, code }) → consumeCode(email, code) → setEmailVerified(userId) → createSession() → returns sessionId
[ FAIL ] correct code → account marked emailVerified = true
[ FAIL ] correct code → session created with { userId, username, authMethod: 'password' }
[ FAIL ] wrong code → throws InvalidVerificationCodeError (code NOT consumed, user can retry)
[ FAIL ] expired code (15min elapsed) → throws ExpiredVerificationCodeError
[ FAIL ] already-verified account → throws AlreadyVerifiedError
[ FAIL ] email not found → throws UserNotFoundError
[ FAIL ] consumeCode is called atomically (GET + DEL in single Redis operation)
─── implement email-verification.service.ts ───
[ PASS ] all
```

**Email Verification Route**:
```
[ FAIL ] POST /auth/verify-email → body: { email, code } → 200 + Set-Cookie session on success
[ FAIL ] POST /auth/verify-email → wrong code → 400 { code: 'INVALID_CODE' }
[ FAIL ] POST /auth/verify-email → expired code → 400 { code: 'CODE_EXPIRED' }
[ FAIL ] POST /auth/verify-email → already verified → 400 { code: 'ALREADY_VERIFIED' }
[ FAIL ] POST /auth/resend-verification → body: { email } → generates new code (overwrites old) → 200
[ FAIL ] POST /auth/resend-verification → already verified → 400 { code: 'ALREADY_VERIFIED' }
─── implement in routes/auth.routes.ts ───
[ PASS ] all
```

---

#### 4.3 — Login

**File**: `src/security/auth/login.service.ts`

```
[ FAIL ] login({ username, password }) → findByUsername() → verifyPassword() → createSession() → returns sessionId
[ FAIL ] wrong username (not found) → throws InvalidCredentialsError (same error as wrong password — no user enumeration)
[ FAIL ] correct username, wrong password → throws InvalidCredentialsError
[ FAIL ] correct username + password → session created with { userId, username, authMethod: 'password' }
[ FAIL ] unverified user (emailVerified = false) → throws UnverifiedEmailError (distinct from InvalidCredentialsError)
[ FAIL ] soft-deleted user → throws InvalidCredentialsError (not 'account deleted' — no enumeration)
[ FAIL ] login is case-insensitive on username (jOhN == john == JOHN)
─── implement login.service.ts ───
[ PASS ] all
```

**Login Route**:
```
[ FAIL ] POST /auth/login → body: { username, password } → 200 + Set-Cookie session
[ FAIL ] POST /auth/login → unverified account → 403 { code: 'EMAIL_NOT_VERIFIED' }
[ FAIL ] POST /auth/login → wrong credentials → 401 { code: 'INVALID_CREDENTIALS' }
[ FAIL ] POST /auth/login → missing body fields → 400 { code: 'VALIDATION_ERROR' }
[ FAIL ] POST /auth/logout → clears session from Redis + clears cookie → 200
[ FAIL ] POST /auth/logout → no session cookie present → still returns 200 (idempotent)
─── implement routes/auth.routes.ts ───
[ PASS ] all
```

---

### MODULE 5 — Password Reset

---

#### 5.1 — Forgot Password (Request)

**File**: `src/security/auth/password-reset.service.ts → requestReset()`

```
[ FAIL ] requestReset(email) → finds user by email → generates 6-digit reset code → stores in Redis under reset:{email} (1hr TTL) → sends email
[ FAIL ] email not found → returns silently (no error — prevents email enumeration)
[ FAIL ] > 3 reset requests in 60min for same IP → throws ResetRateLimitError (no code generated, no email sent)
[ FAIL ] reset email contains the 6-digit code (not a link, not a token)
[ FAIL ] reset code is single-use (consumed on verification, cannot be reused)
─── implement requestReset() ───
[ PASS ] all
```

**Route**:
```
[ FAIL ] POST /auth/forgot-password → body: { email } → always 200 { message: 'If that email exists, a reset code was sent' }
[ FAIL ] POST /auth/forgot-password → rate limited (> 3 in 60min) → 429 { code: 'RATE_LIMITED' }
[ FAIL ] POST /auth/forgot-password → missing email field → 400
─── implement in routes/auth.routes.ts ───
[ PASS ] all
```

---

#### 5.2 — Reset Password (Consume)

**File**: `src/security/auth/password-reset.service.ts → resetPassword()`

```
[ FAIL ] resetPassword(email, code, newPassword) → consumeResetCode(email, code) → updatePasswordHash() → invalidates all existing sessions for user
[ FAIL ] invalid code → throws InvalidResetCodeError
[ FAIL ] expired code (1hr elapsed) → throws InvalidResetCodeError (same error — no timing info leaked)
[ FAIL ] already-used code → throws InvalidResetCodeError
[ FAIL ] new password < 8 chars → throws ValidationError (before code is consumed — don't waste single-use code)
[ FAIL ] all Redis sessions for that userId destroyed after successful reset
─── implement resetPassword() ───
[ PASS ] all
```

**Route**:
```
[ FAIL ] POST /auth/reset-password → body: { email, code, newPassword } → 200 on success
[ FAIL ] POST /auth/reset-password → invalid/expired code → 400 { code: 'INVALID_CODE' }
[ FAIL ] POST /auth/reset-password → weak password → 400 { code: 'VALIDATION_ERROR' }
─── implement in routes/auth.routes.ts ───
[ PASS ] all
```

---

### MODULE 6 — Risk Assessment

---

#### 6.1 — Individual Signal Scorers (Unit, pure functions)

**File**: `src/security/risk/scorers/`

```
── ip-reputation.scorer.ts ──
[ FAIL ] known datacenter/VPN IP range → score = 40
[ FAIL ] Tor exit node IP → score = 100
[ FAIL ] residential IP → score = 0
[ FAIL ] invalid IP format → score = 0

── failed-attempts.scorer.ts ──
[ FAIL ] 0 recent failures → score = 0
[ FAIL ] 3 failures in last 15min → score = 20
[ FAIL ] 5+ failures in last 15min → score = 50
[ FAIL ] failures older than 15min → not counted

── impossible-travel.scorer.ts ──
[ FAIL ] same city, 2hr gap → score = 0
[ FAIL ] London → New York, 1hr gap → score = 100 (physically impossible, 5,500km in 1hr)
[ FAIL ] London → New York, 10hr gap → score = 0 (feasible flight)
[ FAIL ] first login ever (no previous location) → score = 0
[ FAIL ] Haversine formula used for distance (test with known city-pair distances)

── new-device.scorer.ts ──
[ FAIL ] device fingerprint seen before for this user → score = 0
[ FAIL ] new fingerprint not in user's device history → score = 20

─── implement each scorer ───
[ PASS ] all
```

---

#### 6.2 — Risk Aggregator

**File**: `src/security/risk/risk.service.ts`

```
[ FAIL ] aggregate([0, 0, 0]) → level = 'LOW', action = 'ALLOW'
[ FAIL ] aggregate([40, 20, 0]) → level = 'MEDIUM', action = 'STEP_UP' (flag for extra scrutiny, full block in V2)
[ FAIL ] aggregate([40, 50, 20]) → level = 'HIGH', action = 'FORCE_REAUTH'
[ FAIL ] aggregate([100, 50, 20]) → level = 'CRITICAL', action = 'LOCK_ACCOUNT'
[ FAIL ] thresholds are configurable via env (RISK_MEDIUM_THRESHOLD, RISK_HIGH_THRESHOLD, etc.)
─── implement risk.service.ts ───
[ PASS ] all
```

---

#### 6.3 — Security Event Logger

**File**: `src/security/risk/security-events.repository.ts`

```
[ FAIL ] logEvent({ userId, type, ip, userAgent, riskLevel }) → inserts row to security_events table
[ FAIL ] event row contains: id, userId, eventType, ipAddress, userAgent, riskLevel, metadata JSON, createdAt
[ FAIL ] logEvent with type='LOGIN_SUCCESS' → persists
[ FAIL ] logEvent with type='LOGIN_FAILED' → persists
[ FAIL ] logEvent with type='IMPOSSIBLE_TRAVEL' → persists with riskLevel='CRITICAL'
[ FAIL ] logEvent with type='ACCOUNT_LOCKED' → persists
[ FAIL ] getRecentEvents(userId, limit) → returns N most recent events ordered by createdAt DESC
─── implement security-events.repository.ts ───
[ PASS ] all
```

---

### MODULE 7 — Rate Limiting

**File**: `src/security/middleware/rate-limit.config.ts`

```
[ FAIL ] /auth/* routes: 10 requests/min per IP → 11th request within window → 429
[ FAIL ] POST /auth/login: stricter — 5 requests/min per IP + 5 per username (dual counter)
[ FAIL ] POST /auth/forgot-password: 3 requests/hour per IP
[ FAIL ] 429 response includes Retry-After header
[ FAIL ] 429 response includes X-RateLimit-Limit header
[ FAIL ] successful auth does NOT reset failed-attempt rate limit counter (security: don't let success unlock brute force)
[ FAIL ] rate limit counter stored in Redis with correct TTL
─── configure @fastify/rate-limit per route ───
[ PASS ] all
```

---

### MODULE 8 — End-to-End Flows (Playwright)

> Run on a full local stack (real Fastify, real Redis, real Postgres, in-process SMTP server).
> All unit + integration tests must be green before E2E suite runs.

---

#### E2E-1 — Full Registration → Email Verification → Login Flow

```
[ FAIL ] user fills signup form: username=johndoe, email=john@example.com, password=...
         → POST /auth/register → 201 { userId, username, message: 'Check your email for a verification code' }
         → verification code email sent (intercepted in test via mock SMTP)
         → email contains 6-digit numeric code
         → user submits: POST /auth/verify-email { email, code } → 200 + Set-Cookie
         → GET /dashboard → 200, user's name shown
```

---

#### E2E-2 — Unverified Account Blocked from Login

```
[ FAIL ] user registers (POST /auth/register → 201) but does NOT verify email
         → login attempt: POST /auth/login { username, password } → 403 { code: 'EMAIL_NOT_VERIFIED' }
         → user verifies: POST /auth/verify-email { email, code } → 200 + Set-Cookie
         → subsequent POST /auth/login → 200 + Set-Cookie (now unblocked)
```

---

#### E2E-3 — Expired Code → Resend → Verify

```
[ FAIL ] user registers → 6-digit code emailed
         → code expires (advance Redis TTL via test helper)
         → POST /auth/verify-email with stale code → 400 { code: 'CODE_EXPIRED' }
         → POST /auth/resend-verification { email } → 200, new code emailed
         → new code works: POST /auth/verify-email → 200 + Set-Cookie
```

---

#### E2E-4 — Username Case-Insensitive Login

```
[ FAIL ] registered as 'johndoe', email verified
         → login attempt with 'JohnDoe' → 200 + Set-Cookie
         → login attempt with 'JOHNDOE' → 200 + Set-Cookie
```

---

#### E2E-5 — Forgot Password Full Flow (6-Digit Code)

```
[ FAIL ] user submits email on /forgot-password
         → POST /auth/forgot-password → 200 (always, even for unknown email)
         → mock SMTP captures email
         → email contains 6-digit reset code (not a link)
         → user submits: POST /auth/reset-password { email, code, newPassword } → 200
         → old password no longer works: POST /auth/login → 401
         → new password works: POST /auth/login → 200 + Set-Cookie
         → reset code cannot be reused → 400 { code: 'INVALID_CODE' }
```

---

#### E2E-6 — Session Expiry

```
[ FAIL ] user logs in (verify-email path)
         → server-side: Redis session key manually deleted (simulates expiry)
         → user makes any authenticated request
         → 401 returned
         → frontend redirected to /login
```

---

#### E2E-7 — Rate Limit Wall (Login)

```
[ FAIL ] POST /auth/login attempted 6 times with wrong password for same username
         → 6th attempt returns 429 with Retry-After header
         → 429 body contains { code: 'RATE_LIMITED', retryAfter: N }
```

---

### Manual Test Scripts (Live Email Bound)

> Cannot be automated. Each file in `tests/manual/` has: Prerequisites, Steps, Expected Result, Pass Criteria.

| File | Scenario | Why not automated |
|---|---|---|
| `EMAIL_VERIFICATION_DELIVERY.md` | Registration — verify real 6-digit code email is received and code works | Requires live SMTP delivery + real email inbox check |
| `PASSWORD_RESET_EMAIL.md` | Forgot password — verify real 6-digit reset code email is received and code works | Requires live SMTP delivery + real email inbox check |

---

## Coverage Targets

| Layer | Target | Notes |
|---|---|---|
| Unit (`src/security/**`) | 100% | All branches, all error paths |
| Integration (DB + Redis) | 95% | Real I/O, real constraints |
| E2E (browser) | 7 flows, all pass | Happy paths + critical failure paths |
| Manual | 2 scripts, documented | Live email delivery bound scenarios |

**Net automated coverage goal: ~95%**
Remaining ~5% = live email delivery verification = manually scripted.

---

## Dependency List

```jsonc
// package.json (security module dependencies)
{
  "dependencies": {
    "argon2":               "^0.x",   // Argon2id password hashing (native bindings)
    "nodemailer":           "^6.x",   // email delivery (verification + reset codes)
    "ioredis":              "^5.x",   // Redis client
    "@fastify/cookie":      "^9.x",   // session cookie handling
    "@fastify/rate-limit":  "^9.x"    // rate limiting with Redis store
  },
  "devDependencies": {
    "vitest":                     "^2.x",
    "@vitest/coverage-v8":        "^2.x",
    "testcontainers":             "^10.x",
    "playwright":                 "^1.x",
    "@playwright/test":           "^1.x"
  }
}
```

**Node.js `crypto` (built-in, zero install)** handles:
- Session ID generation (`randomBytes(32)`)
- Verification code generation (`randomInt(0, 1000000)` zero-padded to 6 digits)
- Password reset code generation (`randomInt(0, 1000000)` zero-padded to 6 digits)
- Argon2id pepper (`createHmac('sha256', PEPPER)`)

---

## Module Build Order (strict sequence)

```
1.  Crypto primitives              (no dependencies)
2.  Data layer / repositories      (depends on: DB schema)
3.  Session management             (depends on: crypto, Redis)
4.  Username + Password auth       (depends on: crypto/argon2, session, DB)
5.  Password reset                 (depends on: crypto/reset-code, Redis, email service)
6.  Risk assessment                (depends on: DB, Redis)
7.  Rate limiting                  (depends on: Redis)
8.  E2E suite                      (depends on: all above green)
```

Every module: **write failing test → implement → pass → next module**.
No module is considered done until its tests are green AND the modules above it still pass (regression check).
