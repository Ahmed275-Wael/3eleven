# Lead Generation System — V1 Blueprint

> **Three pillars**: What we build, How we build it, How we deliver it.
>
> **V1 Identity**: THE CAPTURE ENGINE — forms, badges, QR codes, CRM sync, lead management.
> Scraping and outreach come in V2/V3. V1 ships a product people CAPTURE leads with.

---

# 1. V1 FEATURES — THE DEFINITIVE LIST

> Nothing more, nothing less. Every feature below ships in V1. Anything not listed waits for V2+.

---

## F1 — Lead Capture System (PRIMARY MODULE)

> Every way a lead can enter the system. This is the #1 reason users sign up.

### F1.A — Capture Methods

| # | Feature | Input | Output | Priority |
|---|---|---|---|---|
| F1.1 | **Embeddable Lead Forms** | User designs form → gets HTML embed snippet or hosted URL | Form submissions flow into lead database in real-time | MUST |
| F1.2 | **Form Builder** | Drag-and-drop: name, email, phone, company, job title, custom fields, dropdowns, checkboxes, file uploads. Conditional logic (show field B only if field A = X). | Saved form template, rendered as embeddable widget or hosted page | MUST |
| F1.3 | **QR Code Generation** | Any form → auto-generated unique QR code (PNG/SVG download) | Printable QR for business cards, booth banners, flyers, packaging. Scan → opens form. | MUST |
| F1.4 | **Badge Generation & Scanning** | Upload attendee list → generate printable name badges with embedded QR/barcode. Scan badge with phone camera → pulls attendee info → rep adds qualification notes. | Captured lead with event context and qualification data | MUST |
| F1.5 | **Manual Lead Entry** | Quick-add form in dashboard: name, email, phone, company, notes, tags. Bulk entry mode. | Lead saved to database | MUST |
| F1.6 | **CSV/Excel Import** | Upload file → column mapping UI → duplicate handling (skip/merge/overwrite) → preview → import | Leads imported with mapped fields | MUST |
| F1.7 | **CSV Export** | Select leads or entire list | Downloaded CSV with all lead columns | MUST |

### F1.B — Capture Intelligence

| # | Feature | Input | Output | Priority |
|---|---|---|---|---|
| F1.8 | **Real-Time Qualification** | Configurable qualification questions attached to any capture method. Budget? Timeline? Interest level? Product fit? | Qualification score stored per lead at moment of capture | MUST |
| F1.9 | **Capture Source Tracking** | Automatic: tags every lead with HOW (form, QR, badge, manual, import) and WHERE (which specific form/event). Parses UTM parameters for web forms. | Source attribution data per lead | MUST |
| F1.10 | **Webhook on Capture** | Configure URL → on any capture event, POST full lead payload as JSON. Retry on failure. Delivery log. | Real-time data push to any external system | MUST |

**What's NOT in V1**: AI chatbot capture, landing page builder, form A/B testing, gamification (spin-to-win etc.).

---

## F2 — CRM Integrations

> Users live in HubSpot, Salesforce, Pipedrive. We capture leads and PUSH them there instantly.

| # | Feature | Input | Output | Priority |
|---|---|---|---|---|
| F2.1 | **HubSpot Integration** | OAuth connection + field mapping | Auto-push captured leads as HubSpot contacts. Create deals/notes from qualification data. | MUST |
| F2.2 | **Salesforce Integration** | OAuth connection + field mapping | Push leads as Salesforce Lead/Contact objects. Custom field + record type support. | MUST |
| F2.3 | **Pipedrive Integration** | OAuth connection + field mapping | Push leads as Pipedrive persons and optionally create deals. | MUST |
| F2.4 | **Generic Webhook Push** | Configurable URL + event triggers | On lead captured / qualified / updated → POST JSON. Retry logic + delivery log. | MUST |
| F2.5 | **Zapier Connector** | Zapier app with triggers + actions | Triggers: New Lead, Lead Qualified, Lead Updated. Actions: Create Lead, Update Lead. 5000+ app integrations. | MUST |
| F2.6 | **Integration Field Mapping UI** | Our lead fields → CRM fields | Drag-and-drop field mapper. Save mapping templates. Different mappings per form/source. | MUST |
| F2.7 | **Sync Status Dashboard** | Connected integrations | Per-lead: "Synced to HubSpot ✓ / Failed ✖ — retry". Per-integration: success rate, last sync time, error count. | MUST |

**What's NOT in V1**: Two-way CRM sync (pull data back), Zoho/Close.com/Monday, native Make/n8n connectors.

---

## F3 — Lead Management

> Every captured lead lives here. Search, filter, organize, act.

| # | Feature | Input | Output | Priority |
|---|---|---|---|---|
| F3.1 | **Lead Database** | All captured/imported leads | Searchable, sortable table. Columns: name, email, phone, company, source, score, status, tags, capture date. | MUST |
| F3.2 | **Lead Lists** | User-created named lists | Organize leads by event, campaign, segment. A lead can belong to multiple lists. | MUST |
| F3.3 | **Tags & Labels** | Custom text tags per lead | Freeform: "hot", "SXSW-2026", "CEO", "follow-up". Bulk add/remove. Filter by tag. | MUST |
| F3.4 | **Search & Filter** | Filter by any field, tag, source, score, status, list, date range | Narrowed lead view. Full-text search across all fields. | MUST |
| F3.5 | **Deduplication** | Email match on capture/import | Options: skip duplicate, merge (keep newest), overwrite. Duplicate report. | MUST |
| F3.6 | **Lead Detail View** | Click on any lead | Full profile: all fields, notes, capture history, qualification answers, CRM sync status. | MUST |
| F3.7 | **Notes** | Free-text per lead | Timestamped. Multiple notes. "Called 3/1, interested in Pro plan, follow up Friday." | MUST |
| F3.8 | **Lead Status Pipeline** | Configurable stages | New → Contacted → Qualified → Meeting Booked → Won / Lost. Simple Kanban column view. Manual or auto-update. | MUST |
| F3.9 | **Bulk Actions** | Select multiple leads | Bulk: add to list, add tag, change status, export, delete. | MUST |
| F3.10 | **Blacklist** | Email or domain | Global exclusion — never captured, never emailed (future). | MUST |

**What's NOT in V1**: Kanban drag-and-drop (just column view), activity timeline, task manager, deal values, lead scoring (V2), enrichment (V3).

---

## F4 — Analytics Dashboard

| # | Feature | What It Shows | Priority |
|---|---|---|---|
| F4.1 | **Capture Overview** | Total leads captured: today / this week / this month. Breakdown by source: form, QR, badge, manual, import. | MUST |
| F4.2 | **Form Performance** | Per-form: views, submissions, conversion rate. Ranked list of forms by performance. | MUST |
| F4.3 | **Source Attribution** | Which capture method produces highest-quality leads (by qualification score)? | MUST |
| F4.4 | **CRM Sync Health** | Per-integration: sync success/failure rate, pending syncs, failed syncs with retry option. | MUST |
| F4.5 | **Daily/Weekly Trend** | Time-series chart: leads captured per day, by source. Qualification rate overlay. | MUST |
| F4.6 | **Account Usage** | Leads captured / limit, Forms created / limit, CRM syncs / limit. | MUST |

**What's NOT in V1**: Campaign analytics (V2), ROI tracking, funnel visualization, exportable reports, team analytics (V4).

---

## F5 — Security, Auth & Billing

> The security module is the **foundation everything else sits on**. In a modular monolith, every other module calls into this one — for session verification, user identity, plan enforcement, and risk signals. It must be defined completely before any other module is built.

---

### F5.A — Authentication Strategy

```
PRIORITY HIERARCHY (V1):

  PRIMARY ──────────────→  Passkeys (WebAuthn / FIDO2)
                                │
                                ↓ user clicks "other options"
  FALLBACK ─────────────→  OAuth 2.1 + PKCE + mandatory TOTP MFA
                           (Google, Microsoft)

HARD BANS in V1:
  ✖ Email + password login       (deferred to V2 — last-resort fallback)
  ✖ bcrypt                        (GPU-vulnerable — never used)
  ✖ OAuth 2.0                     (Implicit flow, optional PKCE — banned)
  ✖ SMS OTP                       (SIM-swap vulnerable — never used)
  ✖ Any MFA bypass path           (MFA on OAuth path is non-negotiable)

ADDED IN V2:
  LAST RESORT ──────────→  Email + Password (Argon2id + pepper) + mandatory TOTP MFA
```

---

### F5.B — V1 Auth Features

| # | Feature | Details | Priority |
|---|---|---|---|
| F5.1 | **Passkey Registration** | User registers device credential via WebAuthn API. Browser generates key pair — private key stays in Secure Enclave/TPM, public key stored in DB. Biometric or hardware PIN unlocks signing. Domain-bound: only works on `yourapp.com`, not phishing clones. | MUST |
| F5.2 | **Passkey Login** | Server issues a random challenge → user's device signs it with private key → server verifies signature against stored public key → session issued. Zero password transmitted. Zero secret stored server-side. | MUST |
| F5.3 | **Multi-Device Passkey Sync** | Users can register multiple passkeys (phone, laptop, hardware key). Each listed and removable in security settings. Minimum 1 always enforced before removal. | MUST |
| F5.4 | **OAuth 2.1 + PKCE Login (Google / Microsoft)** | PKCE mandatory. `code_challenge = BASE64URL(SHA256(code_verifier))`. Exact redirect URI matching. Short-lived authorization codes (60s). Refresh token rotation on every use. Access tokens expire in 15 min. | MUST |
| F5.5 | **Mandatory TOTP MFA (OAuth path)** | After OAuth callback succeeds, TOTP challenge is required before session is issued. Authenticator app only (Google Authenticator, Authy, 1Password). No SMS. No email OTP. First login triggers MFA enrollment flow — cannot skip. | MUST |
| F5.6 | **MFA Recovery Codes** | 8 single-use backup codes generated at MFA enrollment. Shown once, expected to be printed/stored. Each code invalidated on use. Regeneration requires current TOTP verification. | MUST |
| F5.7 | **Server-Side Redis Sessions** | On auth success: generate random 256-bit session ID → store `{userId, ip, deviceFingerprint, createdAt, lastActiveAt}` in Redis with TTL → send as `HttpOnly; Secure; SameSite=Strict` cookie. No JWT stored client-side. Logout = `DEL sessionKey` in Redis → immediately invalid. | MUST |
| F5.8 | **Session Lifecycle** | Sliding expiry: 24h of activity. Idle timeout: 2h inactivity. Absolute max: 30 days then forced re-auth. Session list visible in security settings (device, IP, last seen). One-click remote revocation of any session. | MUST |
| F5.9 | **Adaptive Risk Assessment** | On every login: score IP (known? Tor? datacenter?), device fingerprint (new?), geography (impossible travel?), time pattern (3am for a 9-5 user?), failed attempt history. LOW → proceed. MEDIUM → re-trigger MFA. HIGH → force full re-auth + alert email. CRITICAL → account lock + manual unlock via email. | MUST |
| F5.10 | **Rate Limiting (Auth Endpoints)** | `/auth/*` endpoints: 10 attempts per 15 min per IP. Exponential backoff after 5 failures. Separate limits per endpoint (login vs. MFA vs. passkey registration). Redis-backed counters. | MUST |
| F5.11 | **Security Settings Page** | List all registered passkeys (name, device, registered date) + add/remove. List all active sessions + remote revoke. View MFA status + regenerate backup codes. View security event log (last 10 logins: time, IP, device, method). | MUST |

---

### F5.C — What V2 Adds (Email + Password Fallback)

> Not shipped in V1. Deliberately deferred — the two V1 methods are sufficient and more secure. Adding password auth in V2 requires the full Argon2id pipeline to be production-hardened first.

| # | Feature | Details |
|---|---|---------|
| V2.F5.A | **Email + Password Registration** | Password hashed with Argon2id (`m=65536`, `t=3`, `p=4`, 16-byte random salt, 32-byte output). Server-side pepper (`HMAC-SHA256(password, pepper)` before Argon2id — pepper in env vars, not DB). |
| V2.F5.B | **Email Verification** | Signed token (HMAC-SHA256, 24h TTL) sent to email. Account not active until verified. |
| V2.F5.C | **Password Login + mandatory TOTP MFA** | No bypass. Same TOTP stack as OAuth path. |
| V2.F5.D | **Password Reset** | Time-limited signed token (15 min TTL). Single-use. Invalidates all existing sessions on reset. |
| V2.F5.E | **Breach Detection** | On password login: check against HaveIBeenPwned k-anonymity API. If breached → force password reset before session issued. |

---

### F5.D — Billing Features

| # | Feature | Details | Priority |
|---|---|---|---|
| F5.12 | **Subscription Plans** | 3-4 tiers via Stripe Checkout. Differentiated by: lead capture limits, form count, CRM integrations, analytics. | MUST |
| F5.13 | **Plan Upgrade/Downgrade** | Self-service via Stripe Customer Portal | MUST |
| F5.14 | **Usage Tracking** | Real-time: leads captured / limit, forms / limit, CRM syncs / limit | MUST |
| F5.15 | **Invoices** | Auto-generated by Stripe, viewable in app | MUST |
| F5.16 | **Plan Guard** | Block capture/form creation when limits exceeded. Show upgrade prompt with clear messaging. | MUST |

**What's NOT in V1**: Email+password login (V2), team/multi-user (V4), RBAC (V4), SSO/SAML (V4), white-label (V4), credit-based overage (V2+).

---

## V1 FEATURE COUNT SUMMARY

| Module | Feature Count | Complexity |
|---|---|---|
| Lead Capture System | 10 | HIGH (form engine, QR generation, badge system, qualification, webhooks) |
| CRM Integrations | 7 | HIGH (3 CRM OAuth APIs + webhook + Zapier + field mapping) |
| Lead Management | 10 | MEDIUM (CRUD + pipeline + UI) |
| Analytics Dashboard | 6 | LOW-MEDIUM (read-only aggregation) |
| Security, Auth & Billing | 16 | HIGH (WebAuthn, OAuth 2.1+PKCE, TOTP MFA, Redis sessions, risk engine, Stripe) |
| **TOTAL** | **49 features** | **~6-8 weeks for experienced dev** |

---
---

# 2. ARCHITECTURE — MODULAR MONOLITH

---

## Core Principles

```
1. ONE deployable unit — single Docker container for the API
2. MODULES are isolated — each module is a self-contained folder
3. MODULES communicate via Event Bus — not direct imports
4. MODULES own their DB tables — no cross-module queries
5. SHARED layer is minimal — only DB client, event bus, auth, types
6. EXTRACTION is mechanical — move folder → add Dockerfile → swap events to Redis
```

---

## System Architecture Diagram

```
                    ┌──────────────────────────┐
                    │      CLOUDFLARE           │
                    │  DNS + CDN + SSL + DDoS   │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │    NEXT.JS FRONTEND       │
                    │    (apps/web)             │
                    │                           │
                    │  Pages:                   │
                    │  /dashboard               │
                    │  /leads                   │
                    │  /forms (builder + list)  │
                    │  /badges (generator)      │
                    │  /integrations (CRM)      │
                    │  /analytics               │
                    │  /settings                │
                    │  /billing                 │
                    └────────────┬─────────────┘
                                 │ HTTPS (REST API)
                    ┌────────────▼─────────────┐
                    │    FASTIFY API SERVER      │
                    │    (apps/api)             │
                    │                           │
                    │  Middleware:              │
                    │  ├─ Auth (session verify) │
                    │  ├─ Rate Limiter          │
                    │  ├─ Plan Guard            │
                    │  ├─ Request Validation    │
                    │  └─ Error Handler         │
                    │                           │
                    │  Modules:                 │
                    │  ┌─────────────────────┐  │
                    │  │ AUTH MODULE         │  │
                    │  │ routes → service    │  │
                    │  │ → repository        │  │
                    │  └─────────────────────┘  │
                    │  ┌─────────────────────┐  │
                    │  │ CAPTURE MODULE      │  │
                    │  │ routes → service    │  │
                    │  │ → forms engine      │  │
                    │  │ → badge generator   │  │
                    │  │ → QR generator      │  │
                    │  │ → qualification     │  │
                    │  │ → webhook dispatcher│  │
                    │  └─────────────────────┘  │
                    │  ┌─────────────────────┐  │
                    │  │ INTEGRATIONS MODULE │  │
                    │  │ routes → service    │  │
                    │  │ → hubspot adapter   │  │
                    │  │ → salesforce adapter│  │
                    │  │ → pipedrive adapter │  │
                    │  │ → webhook adapter   │  │
                    │  │ → field mapper      │  │
                    │  │ → sync queue        │  │
                    │  └─────────────────────┘  │
                    │  ┌─────────────────────┐  │
                    │  │ LEADS MODULE        │  │
                    │  │ routes → service    │  │
                    │  │ → repository → CSV  │  │
                    │  │ → deduplication     │  │
                    │  │ → pipeline          │  │
                    │  └─────────────────────┘  │
                    │  ┌─────────────────────┐  │
                    │  │ ANALYTICS MODULE    │  │
                    │  │ routes → service    │  │
                    │  │ → aggregation       │  │
                    │  └─────────────────────┘  │
                    │  ┌─────────────────────┐  │
                    │  │ BILLING MODULE      │  │
                    │  │ routes → stripe     │  │
                    │  │ → usage tracker     │  │
                    │  │ → webhook handler   │  │
                    │  └─────────────────────┘  │
                    └────┬──────┬──────┬───────┘
                         │      │      │
            ┌────────────┘      │      └────────────┐
            ▼                   ▼                    ▼
     ┌─────────────┐   ┌─────────────┐      ┌─────────────┐
     │ PostgreSQL  │   │    Redis    │      │   BullMQ    │
     │             │   │             │      │   Workers   │
     │ Tables:     │   │ • Sessions  │      │             │
     │ • users     │   │ • Cache     │      │ Queues:     │
     │ • leads     │   │ • Rate      │      │ • crm-sync  │
     │ • forms     │   │   limits    │      │ • webhook   │
     │ • badges    │   │ • Event Bus │      │ • capture   │
     │ • integs    │   │   (future)  │      │   processing│
     │ • events    │   │             │      │             │
     │ • billing   │   │             │      │             │
     └─────────────┘   └─────────────┘      └─────────────┘
                                                    │
                                            ┌───────┴───────┐
                                            ▼               ▼
                                     ┌──────────┐   ┌──────────┐
                                     │ HubSpot  │   │Salesforce│
                                     │ API      │   │ API      │
                                     └──────────┘   └──────────┘
                                            ▼               ▼
                                     ┌──────────┐   ┌──────────┐
                                     │ Pipedrive│   │ User     │
                                     │ API      │   │ Webhooks │
                                     └──────────┘   └──────────┘
```

---

## Security Module — The Cross-Cutting Foundation

> Every other module depends on the Security Module. It is the only module allowed to be called by ALL other modules directly via its public interface. It propagates identity, session context, and plan state throughout the entire system.

```
SECURITY MODULE PROPAGATION:

  ┌─────────────────────────────────────────────────────────────────┐
  │                    SECURITY MODULE                               │
  │                                                                  │
  │  Public interface exported to ALL modules:                       │
  │                                                                  │
  │  verifySession(req)     → { userId, planId, sessionId } | null  │
  │  requireAuth(req, res)  → throws 401 if no valid session        │
  │  requirePlan(tier)      → throws 403 if plan insufficient       │
  │  getRiskScore(req)      → RiskLevel (LOW/MEDIUM/HIGH/CRITICAL)  │
  │  getCurrentUser(req)    → User object                           │
  └──────────────────────────────────────────────────────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
   ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌────────────┐
   │  CAPTURE   │ │INTEGRATIONS│ │  LEADS   │ │ ANALYTICS  │
   │  MODULE    │ │  MODULE    │ │  MODULE  │ │  MODULE    │
   │            │ │            │ │          │ │            │
   │ calls:     │ │ calls:     │ │ calls:   │ │ calls:     │
   │ requireAuth│ │ requireAuth│ │requireAuth│ │requireAuth │
   │ requirePlan│ │ requirePlan│ │requirePlan│ │            │
   │ getUser    │ │ getUser    │ │ getUser  │ │            │
   └────────────┘ └────────────┘ └──────────┘ └────────────┘

RULE: No module implements its own auth check.
      No module reads the session cookie directly.
      No module queries the users table directly.
      ALL identity/session operations go through Security Module.
```

---

### Security Module Public Contract (TypeScript)

```typescript
// modules/security/index.ts — THE PUBLIC INTERFACE
// This is the ONLY thing other modules import from security/

export interface AuthenticatedUser {
  id: string
  email: string
  planId: string
  planTier: 'starter' | 'growth' | 'pro' | 'agency'
  sessionId: string
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface SecurityModule {
  // Middleware — attach to any route that requires login
  requireAuth: (req: FastifyRequest, res: FastifyReply) => Promise<void>

  // Middleware — attach to routes that require a specific plan tier
  requirePlan: (minTier: PlanTier) => RouteMiddleware

  // Read the authenticated user from an already-verified request
  getCurrentUser: (req: FastifyRequest) => AuthenticatedUser

  // Risk assessment — called on login and sensitive actions
  getRiskScore: (req: FastifyRequest) => Promise<RiskLevel>

  // Explicit session operations
  invalidateSession: (sessionId: string) => Promise<void>
  invalidateAllUserSessions: (userId: string) => Promise<void>
}
```

---

### How Other Modules Use Security (Example)

```typescript
// modules/capture/capture.routes.ts
import { securityModule } from '../security'   // ← only public interface

// Public capture endpoint (form submission — no auth needed)
fastify.post('/api/capture/:formId', async (req, res) => {
  // No auth check — public endpoint for form submitters
  await captureService.processSubmission(req.params.formId, req.body)
})

// Protected endpoint (create a form — requires login + plan)
fastify.post('/api/forms',
  { preHandler: [securityModule.requireAuth, securityModule.requirePlan('starter')] },
  async (req, res) => {
    const user = securityModule.getCurrentUser(req)  // ← typed, no raw DB query
    await formsService.create(user.id, req.body)
  }
)
```

```typescript
// modules/integrations/integrations.routes.ts
// CRM connection requires auth — integrations module does NOT care HOW auth works
// It just gates on the result
fastify.post('/api/integrations/hubspot/connect',
  { preHandler: [securityModule.requireAuth] },
  async (req, res) => {
    const user = securityModule.getCurrentUser(req)
    await integrationsService.connectHubspot(user.id, req.body.code)
  }
)
```

The capture module, integrations module, leads module — none of them know whether the user logged in via Passkey, OAuth, or (in V2) password. They receive a typed `AuthenticatedUser` object. Auth method is entirely encapsulated.

---

## Module Communication Rules

```
┌─────────────────────────────────────────────────────────────┐
│                  HOW MODULES TALK TO EACH OTHER              │
│                                                              │
│  ALLOWED:                                                    │
│  ┌──────────┐    Event Bus     ┌──────────────┐            │
│  │ Capture  │ ──────────────→  │ Integrations │            │
│  │ Module   │  "lead.captured" │ Module       │            │
│  └──────────┘                  └──────────────┘            │
│                                                              │
│  ┌──────────┐    Event Bus     ┌──────────────┐            │
│  │ Capture  │ ──────────────→  │ Analytics    │            │
│  │ Module   │ "lead.captured"  │ Module       │            │
│  └──────────┘                  └──────────────┘            │
│                                                              │
│  ┌──────────┐   Public Interface  ┌──────────────┐         │
│  │ Integr.  │ ──────────────────→ │ Leads        │         │
│  │ Module   │   leadsModule.      │ Module       │         │
│  └──────────┘   getById()         └──────────────┘         │
│                                                              │
│  FORBIDDEN:                                                  │
│  ┌──────────┐   Direct DB Query   ┌──────────────┐         │
│  │ Integr.  │ ────────  ✖  ─────→ │ leads table  │         │
│  │ Module   │                     │ (owned by    │         │
│  └──────────┘                     │ Leads Module)│         │
│                                   └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## The Capture-to-CRM Event Flow

```
CAPTURE EVENT FLOW (the core V1 pipeline):

  Form Submitted / Badge Scanned / QR Scanned / Manual Entry / CSV Import
       │
       ▼
  ┌────────────────────────────────┐
  │  CAPTURE MODULE                │
  │                                │
  │  1. Validate required fields   │
  │  2. Parse UTM / source data    │
  │  3. Run qualification survey   │
  │     (if attached to source)    │
  │  4. Emit: "lead.captured"      │
  └──────────┬─────────────────────┘
             │
     ┌───────┴───────┬────────────────┐
     ▼               ▼                ▼
  ┌────────┐   ┌──────────┐   ┌────────────┐
  │ LEADS  │   │ INTEGR.  │   │ ANALYTICS  │
  │ MODULE │   │ MODULE   │   │ MODULE     │
  │        │   │          │   │            │
  │ Store  │   │ For each │   │ Increment  │
  │ in DB  │   │ active   │   │ capture    │
  │ Dedup  │   │ CRM:     │   │ counters   │
  │ Tag    │   │  • Map   │   │ per source │
  │        │   │    fields│   │            │
  │        │   │  • Push  │   │            │
  │        │   │  • Log   │   │            │
  └────────┘   └──────────┘   └────────────┘
```

---

## File Structure

```
lead-gen/
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile
├── turbo.json
├── pnpm-workspace.yaml
├── .env.example
├── .github/workflows/deploy.yml
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── event-bus.ts           # EventEmitter now → Redis later
│       │   ├── types/                 # Lead, Form, Badge, Integration types
│       │   ├── validation/            # Zod schemas
│       │   └── errors.ts             # Custom error classes
│       └── package.json
│
├── apps/
│   ├── web/                           # FRONTEND
│   │   ├── src/app/                   # Next.js App Router
│   │   │   ├── (auth)/               # Login, Register, Reset
│   │   │   ├── (dashboard)/          # Main app layout
│   │   │   │   ├── dashboard/        # Overview page
│   │   │   │   ├── leads/            # Lead database, detail, import
│   │   │   │   ├── forms/            # Form builder, form list, embed codes
│   │   │   │   ├── badges/           # Badge generator, event management
│   │   │   │   ├── integrations/     # CRM connections, field mapping, sync log
│   │   │   │   ├── analytics/        # Charts, metrics
│   │   │   │   ├── settings/         # Profile, account
│   │   │   │   └── billing/          # Plans, usage, invoices
│   │   │   ├── api/                  # Next.js API routes (proxy or BFF)
│   │   │   └── capture/              # PUBLIC: hosted form pages (no auth)
│   │   │       └── [formId]/         # /capture/abc123 → renders the form
│   │   ├── src/components/
│   │   │   ├── ui/                   # shadcn/ui base components
│   │   │   ├── forms/                # Form builder components
│   │   │   │   ├── form-builder.tsx  # Drag-and-drop builder
│   │   │   │   ├── form-renderer.tsx # Renders form from schema (used in embed + hosted)
│   │   │   │   ├── form-preview.tsx  # Live preview in builder
│   │   │   │   └── field-types/      # Text, email, phone, dropdown, checkbox, etc.
│   │   │   ├── badges/               # Badge template editor, print layout
│   │   │   ├── leads/                # Lead table, detail view, pipeline
│   │   │   ├── integrations/         # CRM setup wizards, field mapper
│   │   │   └── analytics/            # Chart components
│   │   ├── src/hooks/                # useLeads, useForms, useIntegrations, etc.
│   │   ├── src/lib/                  # API client, utils
│   │   └── package.json
│   │
│   └── api/                           # BACKEND (Modular Monolith)
│       ├── src/
│       │   ├── server.ts              # Fastify entry + module registration
│       │   ├── config/
│       │   │   ├── env.ts             # Zod-validated env vars
│       │   │   ├── database.ts        # Drizzle + PostgreSQL
│       │   │   ├── redis.ts           # Redis client
│       │   │   └── queue.ts           # BullMQ setup
│       │   │
│       │   ├── modules/
│       │   │   ├── security/                          # THE CROSS-CUTTING FOUNDATION
│       │   │   │   ├── index.ts                       # Public interface — ONLY file other modules import
│       │   │   │   │                                  # exports: requireAuth, requirePlan, getCurrentUser,
│       │   │   │   │                                  #          getRiskScore, invalidateSession
│       │   │   │   │
│       │   │   │   ├── passkey/
│       │   │   │   │   ├── passkey.routes.ts          # POST /auth/passkey/register/start
│       │   │   │   │   │                             # POST /auth/passkey/register/finish
│       │   │   │   │   │                             # POST /auth/passkey/login/start
│       │   │   │   │   │                             # POST /auth/passkey/login/finish
│       │   │   │   │   ├── passkey.service.ts         # WebAuthn orchestration logic
│       │   │   │   │   ├── passkey.repository.ts      # CRUD for user_credentials table
│       │   │   │   │   └── passkey.schema.ts          # Zod: registration + authentication options
│       │   │   │   │
│       │   │   │   ├── oauth/
│       │   │   │   │   ├── oauth.routes.ts            # GET  /auth/oauth/:provider          (initiate)
│       │   │   │   │   │                             # GET  /auth/oauth/:provider/callback  (receive code)
│       │   │   │   │   ├── oauth.service.ts           # PKCE flow, token exchange, user upsert
│       │   │   │   │   ├── pkce.service.ts            # code_verifier generation, code_challenge = SHA256
│       │   │   │   │   └── providers/
│       │   │   │   │       ├── google.provider.ts     # OAuth 2.1 endpoints, scopes, field mapping
│       │   │   │   │       └── microsoft.provider.ts  # OAuth 2.1 endpoints, scopes, field mapping
│       │   │   │   │
│       │   │   │   ├── mfa/
│       │   │   │   │   ├── mfa.routes.ts              # POST /auth/mfa/enroll/start
│       │   │   │   │   │                             # POST /auth/mfa/enroll/verify
│       │   │   │   │   │                             # POST /auth/mfa/verify
│       │   │   │   │   │                             # POST /auth/mfa/recover
│       │   │   │   │   ├── mfa.service.ts             # TOTP secret generation, QR code for authenticator
│       │   │   │   │   │                             # TOTP code verification (30s window ±1 drift)
│       │   │   │   │   ├── totp.service.ts            # RFC 6238 TOTP: HMAC-SHA1, 30s step, 6 digits
│       │   │   │   │   └── recovery.service.ts        # 8 single-use codes, bcrypt-stored, invalidate on use
│       │   │   │   │                                  # NOTE: bcrypt IS used here — not for passwords,
│       │   │   │   │                                  # but for recovery codes (no GPU attack surface
│       │   │   │   │                                  # since attacker needs code first, not hash)
│       │   │   │   │
│       │   │   │   ├── session/
│       │   │   │   │   ├── session.service.ts         # Create/read/destroy Redis sessions
│       │   │   │   │   │                             # generateSessionId() = crypto.randomBytes(32)
│       │   │   │   │   │                             # cookie: HttpOnly + Secure + SameSite=Strict
│       │   │   │   │   ├── session.repository.ts      # Redis SET/GET/DEL/SCAN for sessions
│       │   │   │   │   └── session.schema.ts          # SessionData type: userId, planId, ip,
│       │   │   │   │                                  # deviceFingerprint, createdAt, lastActiveAt
│       │   │   │   │
│       │   │   │   ├── risk/
│       │   │   │   │   ├── risk.service.ts            # Score: IP reputation + device fingerprint
│       │   │   │   │   │                             # + geo/impossible-travel + time pattern
│       │   │   │   │   │                             # + failed attempt history
│       │   │   │   │   │                             # → LOW/MEDIUM/HIGH/CRITICAL
│       │   │   │   │   └── fingerprint.service.ts     # Build device fingerprint from User-Agent,
│       │   │   │   │                                  # Accept-Language, screen hints, timezone
│       │   │   │   │
│       │   │   │   ├── middleware/
│       │   │   │   │   ├── require-auth.ts            # Reads session cookie → validates in Redis
│       │   │   │   │   │                             # → attaches user to req.user → 401 if invalid
│       │   │   │   │   ├── require-plan.ts            # Reads req.user.planTier → 403 if below minimum
│       │   │   │   │   └── rate-limit.ts              # Per-endpoint Redis counters
│       │   │   │   │                                  # /auth/*: 10 req/15min/IP
│       │   │   │   │                                  # /api/*: 300 req/min/user
│       │   │   │   │
│       │   │   │   ├── users/
│       │   │   │   │   ├── users.repository.ts        # ONLY place that queries the users table
│       │   │   │   │   └── users.service.ts           # Profile updates, security settings, session list
│       │   │   │   │
│       │   │   │   └── security.schema.ts             # DB tables: users, user_credentials,
│       │   │   │                                      # user_sessions_meta, security_events
│       │   │   │
│       │   │   ├── capture/
│       │   │   │   ├── index.ts       # Public interface
│       │   │   │   ├── capture.routes.ts     # POST /api/capture (public)
│       │   │   │   ├── capture.service.ts    # Core capture logic
│       │   │   │   ├── forms/
│       │   │   │   │   ├── forms.routes.ts   # CRUD for form definitions
│       │   │   │   │   ├── forms.service.ts  # Form builder logic
│       │   │   │   │   ├── forms.schema.ts   # Zod: form field definitions
│       │   │   │   │   └── form-renderer.ts  # Server-side form validation
│       │   │   │   ├── badges/
│       │   │   │   │   ├── badges.routes.ts  # Badge generation endpoints
│       │   │   │   │   ├── badges.service.ts # Generate badge images/PDFs
│       │   │   │   │   └── scanner.service.ts # Process badge scans
│       │   │   │   ├── qr/
│       │   │   │   │   └── qr.service.ts     # QR code generation (qrcode lib)
│       │   │   │   ├── qualification/
│       │   │   │   │   ├── qualification.service.ts  # Survey logic + scoring
│       │   │   │   │   └── qualification.schema.ts   # Question/answer schemas
│       │   │   │   └── webhook/
│       │   │   │       ├── webhook.service.ts   # Dispatch capture webhooks
│       │   │   │       └── webhook.queue.ts     # Retry failed webhooks
│       │   │   │
│       │   │   ├── integrations/
│       │   │   │   ├── index.ts
│       │   │   │   ├── integrations.routes.ts
│       │   │   │   ├── integrations.service.ts    # Orchestrates CRM pushes
│       │   │   │   ├── integrations.queue.ts      # BullMQ job for async sync
│       │   │   │   ├── field-mapper.ts            # Transform lead → CRM format
│       │   │   │   ├── sync-log.repository.ts     # Track sync success/failure
│       │   │   │   └── adapters/
│       │   │   │       ├── hubspot.adapter.ts     # HubSpot API client
│       │   │   │       ├── salesforce.adapter.ts  # Salesforce API client
│       │   │   │       ├── pipedrive.adapter.ts   # Pipedrive API client
│       │   │   │       └── webhook.adapter.ts     # Generic HTTP webhook
│       │   │   │
│       │   │   ├── leads/
│       │   │   │   ├── index.ts
│       │   │   │   ├── leads.routes.ts
│       │   │   │   ├── leads.service.ts
│       │   │   │   ├── leads.repository.ts
│       │   │   │   ├── leads.schema.ts
│       │   │   │   ├── leads.csv.ts               # Import/export logic
│       │   │   │   ├── deduplication.service.ts   # Email-match dedup
│       │   │   │   └── pipeline.service.ts        # Status stage management
│       │   │   │
│       │   │   ├── analytics/
│       │   │   │   ├── index.ts
│       │   │   │   ├── analytics.routes.ts
│       │   │   │   └── analytics.service.ts       # Capture + sync aggregation
│       │   │   │
│       │   │   └── billing/
│       │   │       ├── index.ts
│       │   │       ├── billing.routes.ts
│       │   │       ├── billing.service.ts
│       │   │       ├── usage-tracker.service.ts   # Count leads/forms/syncs
│       │   │       └── stripe.webhook.ts          # Handle Stripe events
│       │   │
│       │   ├── shared/
│       │   │   ├── database/
│       │   │   │   ├── schema.ts      # All Drizzle table definitions
│       │   │   │   └── migrations/
│       │   │   ├── middleware/
│       │   │   │   ├── auth.ts
│       │   │   │   ├── rate-limit.ts
│       │   │   │   └── plan-guard.ts
│       │   │   └── utils/
│       │   │       ├── pagination.ts
│       │   │       └── email-regex.ts
│       │   │
│       │   └── workers/
│       │       ├── index.ts               # Worker entry point
│       │       ├── crm-sync.worker.ts     # Process CRM push jobs
│       │       ├── webhook.worker.ts      # Process webhook deliveries
│       │       └── capture.worker.ts      # Post-capture processing (dedup, qualify)
│       │
│       ├── drizzle.config.ts
│       └── package.json
│
└── docs/
    ├── REQUIREMENTS.md
    ├── CAPTELLO_ANALYSIS.md
    └── FEATURE_PRIORITY_AND_ARCHITECTURE.md
```

---

## Database Schema (Key Tables)

```sql
-- ─────────────────────────────────────────────
-- SECURITY MODULE TABLES (owned by security/)
-- No other module may query these directly
-- ─────────────────────────────────────────────

-- USERS (identity record — minimal, no auth method details here)
users
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  email           VARCHAR(255) UNIQUE NOT NULL
  display_name    VARCHAR(255)
  company         VARCHAR(255)
  timezone        VARCHAR(100)     DEFAULT 'UTC'
  plan_id         UUID REFERENCES plans(id)
  plan_tier       VARCHAR(20)      -- starter / growth / pro / agency
  mfa_enabled     BOOLEAN          DEFAULT false
  account_status  VARCHAR(20)      DEFAULT 'active'  -- active / locked / suspended
  created_at      TIMESTAMPTZ      DEFAULT now()
  updated_at      TIMESTAMPTZ      DEFAULT now()

-- USER CREDENTIALS (passkeys — one user can have many)
user_credentials
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE
  credential_id       BYTEA UNIQUE NOT NULL   -- WebAuthn credential ID (from device)
  public_key          BYTEA NOT NULL          -- COSE-encoded public key
  counter             BIGINT NOT NULL         -- signature counter (replay protection)
  device_type         VARCHAR(50)             -- platform / cross-platform
  device_name         VARCHAR(255)            -- user-assigned: "MacBook Pro", "iPhone 15"
  backed_up           BOOLEAN DEFAULT false   -- synced to iCloud/Google Password Manager?
  transports          TEXT[]                  -- usb / nfc / ble / internal / hybrid
  registered_at       TIMESTAMPTZ DEFAULT now()
  last_used_at        TIMESTAMPTZ

-- OAUTH ACCOUNTS (linked OAuth providers per user)
user_oauth_accounts
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE
  provider        VARCHAR(50) NOT NULL        -- google / microsoft
  provider_user_id VARCHAR(255) NOT NULL      -- subject claim from id_token
  email           VARCHAR(255)
  access_token    TEXT                        -- encrypted at rest
  refresh_token   TEXT                        -- encrypted at rest
  token_expires_at TIMESTAMPTZ
  connected_at    TIMESTAMPTZ DEFAULT now()
  UNIQUE(provider, provider_user_id)

-- MFA TOTP (one per user — only written during enrollment)
user_mfa
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE
  totp_secret     VARCHAR(255) NOT NULL       -- encrypted at rest (AES-256-GCM)
  enrolled_at     TIMESTAMPTZ DEFAULT now()

-- MFA RECOVERY CODES (8 codes per user, each single-use)
user_recovery_codes
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE
  code_hash       VARCHAR(255) NOT NULL       -- bcrypt hash of the 8-char code
  used            BOOLEAN DEFAULT false
  used_at         TIMESTAMPTZ
  created_at      TIMESTAMPTZ DEFAULT now()

-- SESSION METADATA (Redis holds the live session — this is the audit trail)
-- Live sessions: Redis key `session:{id}` → TTL managed by session.service.ts
-- This table records created sessions for the "active sessions" UI view
user_sessions_meta
  id              UUID PRIMARY KEY            -- same ID as Redis session key
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE
  ip_address      INET
  country_code    CHAR(2)
  device_fingerprint VARCHAR(255)
  user_agent      TEXT
  auth_method     VARCHAR(20)                 -- passkey / oauth / password(v2)
  created_at      TIMESTAMPTZ DEFAULT now()
  last_active_at  TIMESTAMPTZ
  revoked_at      TIMESTAMPTZ                 -- NULL if still potentially active

-- SECURITY EVENTS (immutable audit log — never deleted)
security_events
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  user_id         UUID REFERENCES users(id)   -- NULL for pre-auth events (failed login)
  event_type      VARCHAR(50) NOT NULL
    -- passkey_registered, passkey_login_success, passkey_login_fail
    -- oauth_login_success, oauth_login_fail
    -- mfa_enrolled, mfa_verified, mfa_failed, mfa_recovery_used
    -- session_created, session_revoked, all_sessions_revoked
    -- account_locked, account_unlocked
    -- risk_escalation (medium/high/critical)
  ip_address      INET
  device_fingerprint VARCHAR(255)
  metadata        JSONB                       -- extra context per event type
  risk_level      VARCHAR(10)                 -- LOW / MEDIUM / HIGH / CRITICAL
  occurred_at     TIMESTAMPTZ DEFAULT now()

-- ─────────────────────────────────────────────
-- APPLICATION TABLES (owned by their modules)
-- ─────────────────────────────────────────────

-- FORMS
forms
  id              UUID PRIMARY KEY
  user_id         UUID REFERENCES users(id)
  name            VARCHAR(255)
  description     TEXT
  fields          JSONB           -- form builder field definitions
  qualification   JSONB           -- attached qualification questions
  settings        JSONB           -- styling, redirect URL, notifications
  status          VARCHAR(20)     -- draft / published / archived
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ

-- BADGES
badge_events
  id              UUID PRIMARY KEY
  user_id         UUID REFERENCES users(id)
  name            VARCHAR(255)     -- "SXSW 2026", "Product Launch NYC"
  attendees       JSONB            -- uploaded attendee list for badge gen
  badge_template  JSONB            -- layout, logo, fields to show
  created_at      TIMESTAMPTZ

-- LEADS
leads
  id              UUID PRIMARY KEY
  user_id         UUID REFERENCES users(id)
  email           VARCHAR(255)
  first_name      VARCHAR(255)
  last_name       VARCHAR(255)
  phone           VARCHAR(50)
  company         VARCHAR(255)
  job_title       VARCHAR(255)
  custom_fields   JSONB
  capture_source  VARCHAR(50)     -- form / badge / qr / manual / import
  capture_ref     UUID            -- which form/badge_event captured this
  utm_source      VARCHAR(255)
  utm_medium      VARCHAR(255)
  utm_campaign    VARCHAR(255)
  qualification   JSONB           -- qualification answers + score
  status          VARCHAR(50)     -- new / contacted / qualified / meeting / won / lost
  tags            TEXT[]
  notes           JSONB           -- array of {text, timestamp}
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ

  UNIQUE(user_id, email)          -- dedup enforced at DB level

-- CRM INTEGRATIONS
integrations
  id              UUID PRIMARY KEY
  user_id         UUID REFERENCES users(id)
  provider        VARCHAR(50)     -- hubspot / salesforce / pipedrive / webhook
  credentials     JSONB           -- encrypted OAuth tokens or webhook URL
  field_mapping   JSONB           -- our fields → CRM fields
  status          VARCHAR(20)     -- active / paused / error
  created_at      TIMESTAMPTZ

-- CRM SYNC LOG
sync_log
  id              UUID PRIMARY KEY
  integration_id  UUID REFERENCES integrations(id)
  lead_id         UUID REFERENCES leads(id)
  status          VARCHAR(20)     -- success / failed / pending / retrying
  error_message   TEXT
  crm_record_id   VARCHAR(255)   -- HubSpot contact ID, SF Lead ID, etc.
  synced_at       TIMESTAMPTZ
  retry_count     INTEGER DEFAULT 0

-- CAPTURE EVENTS (for analytics)
capture_events
  id              UUID PRIMARY KEY
  user_id         UUID REFERENCES users(id)
  lead_id         UUID REFERENCES leads(id)
  source          VARCHAR(50)
  source_ref      UUID            -- form_id or badge_event_id
  qualified       BOOLEAN
  qualification_score INTEGER
  metadata        JSONB           -- UTMs, device info, IP country
  captured_at     TIMESTAMPTZ
```

---

## Technology Stack

| Layer | Choice | Justification |
|---|---|---|
| Language | TypeScript | Full-stack, type safety, one language everywhere |
| Frontend | Next.js 14 (App Router) | SSR, file routing, React ecosystem |
| UI | Tailwind CSS + shadcn/ui | Fast to build, own the components |
| Charts | Recharts | React-native charting, lightweight |
| Tables | @tanstack/react-table | Sorting, filtering, pagination |
| Form Builder | Custom (React DnD + Zod) | JSON schema-based forms, no vendor lock-in |
| QR Generation | `qrcode` npm package | SVG/PNG QR output, zero server cost |
| Badge Generation | Custom (PDFKit or Puppeteer) | Generate printable PDF badges from templates |
| Backend | Fastify 4 | 2x Express speed, schema validation, TypeScript-first |
| ORM | Drizzle | SQL-like, thin, fast |
| Database | PostgreSQL 16 | JSONB for forms/fields, full-text search, ACID |
| Cache | Redis 7 | Sessions, rate limits, job queue backend |
| Queue | BullMQ | CRM sync retries, webhook delivery, async capture processing |
| WebAuthn (Passkeys) | `@simplewebauthn/server` + `@simplewebauthn/browser` | FIDO2/WebAuthn standard, TypeScript-native, handles challenge/response/verification |
| OAuth 2.1 + PKCE | Custom (no library) | PKCE implemented from scratch using Node `crypto` — no dependency on auth libraries that may implement OAuth 2.0 patterns |
| TOTP MFA | `otplib` | RFC 6238 TOTP, 30s window, 6-digit codes, QR generation for authenticator apps |
| Sessions | Redis (custom) | 256-bit random session IDs, `HttpOnly; Secure; SameSite=Strict` cookie, server-side only. No JWT. |
| Password Hashing (V2) | `argon2` (Node native binding) | Argon2id: `m=65536, t=3, p=4` + server-side pepper via HMAC-SHA256 |
| Auth Framework | None (Lucia removed) | Too opinionated for our multi-method strategy. Security module is fully custom. |
| Validation | Zod | Runtime + static typing, shared FE/BE |
| Payments | Stripe | Subscriptions + usage billing + invoices |
| Monorepo | Turborepo + pnpm | Shared packages, parallel builds |
| Containers | Docker + Docker Compose | Consistent dev/prod environments |
| Hosting | Hetzner VPS (4 vCPU / 8GB) | $12/mo, bare metal performance |
| CDN/DNS | Cloudflare Free | SSL, DDoS, caching, R2 storage for badge PDFs |
| CI/CD | GitHub Actions | Free tier, deploy on push |
| Monitoring | Sentry (free) + Uptime Kuma | Error tracking + uptime alerts |

---
---

# 3. SOLUTION DELIVERY — HOW WE DELIVER TO CLIENTS

---

## Delivery Model: MANAGED SaaS (Primary)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│              WE DO NOT SELL SOFTWARE.                              │
│              WE SELL ACCESS TO A RUNNING SERVICE.                  │
│                                                                   │
│   The client never touches code, servers, or databases.           │
│   They log in, they build forms, they capture leads, they pay.    │
│                                                                   │
│   This gives us:                                                  │
│   • Recurring revenue (not one-time payment)                      │
│   • Full control over updates, features, pricing                  │
│   • Data advantage (aggregate insights across all users)          │
│   • Prevention of piracy/cloning                                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## COMFORT POSITIONS (What Makes Clients Happy)

### C1 — Zero Setup Required

| What We Provide | How It Comforts the Client |
|---|---|
| **Cloud-hosted, always on** | No installation, no servers. Sign up → build form → capture leads. |
| **Onboarding wizard** | Step-by-step: create first form → connect CRM → embed on website. Under 10 minutes. |
| **Pre-built form templates** | "Event Registration", "Contact Us", "Demo Request", "Trade Show Badge" — ready to use. |
| **Responsive dashboard** | Desktop, tablet, mobile — check captured leads anywhere. |

### C2 — Self-Service Everything

| What We Provide | How It Comforts the Client |
|---|---|
| **Self-service billing** | Upgrade, downgrade, cancel, download invoices — no human needed. |
| **Self-service CRM management** | Connect/disconnect CRM integrations, modify field mappings anytime. |
| **Self-service data export** | Export ANY data as CSV at any time. Never feel trapped. |
| **Usage transparency** | Real-time: "You've captured 450/1,000 leads this month." No surprise bills. |

### C3 — Data Portability

| What We Provide | How It Comforts the Client |
|---|---|
| **Full CSV export** | All leads, all capture data — exportable anytime. |
| **No data lock-in** | Paradoxically, easy export INCREASES sign-ups. Trust builds loyalty. |
| **Import from competitors** | "Migrating from Typeform? Upload your CSV." Makes switching TO us easy. |

### C4 — Guided Experience

| What We Provide | How It Comforts the Client |
|---|---|
| **In-app tooltips** | Contextual help on every feature. |
| **Knowledge base** | "How to embed a form", "How to connect HubSpot", "Best practices for event badges." |
| **Suggested next actions** | "You have 200 leads and no CRM connected. Connect HubSpot →" |

---

## CONTROL POSITIONS (What Keeps Us in the Driver's Seat)

### K1 — SaaS-Only Delivery

```
┌──────────────────────────────────────────────────────────────┐
│  We NEVER sell:                                                │
│  ✖ Source code                                                │
│  ✖ Self-hosted licenses                                       │
│  ✖ One-time purchase                                          │
│                                                                │
│  We ALWAYS sell:                                               │
│  ✓ Monthly subscription to OUR hosted platform                │
│  ✓ API access (metered, higher tiers only — V4 feature)       │
│  ✓ White-label only on OUR infrastructure (V4 feature)        │
└──────────────────────────────────────────────────────────────┘
```

### K2 — Usage-Based Metering

| Mechanism | How It Works | Strategic Value |
|---|---|---|
| **Lead capture limits** | Plan includes X captured leads/month. | Directly monetizes the core action. |
| **Form limits** | Starter: 3 forms, Growth: 10, Pro: unlimited. | Forms are the product. More forms = higher plan. |
| **CRM sync limits** | Syncs per month. Higher plans = more syncs. | CRM push is our highest-value action. |
| **Overage pricing** | Exceed limits → buy packs or upgrade. | Revenue expansion without churn. |

```
Plan Guard Flow:
━━━━━━━━━━━━━━

Lead submits form
    │
    ▼
Check: leads_captured_this_month < plan_limit?
    │
    ├─ YES → capture the lead, push to CRM
    │
    └─ NO → Lead is still captured (never lose data!)
            but user sees:
            "You've hit your 1,000 lead limit.
             Upgrade to keep CRM sync active.
             [Upgrade to Growth — $149/mo]"
```

**Important**: We NEVER reject a form submission. The lead is always captured. But CRM sync, qualification, and advanced features pause at the limit. This protects the end-user (the person filling the form) while nudging our customer to upgrade.

### K3 — Infrastructure Control

| Mechanism | Strategic Value |
|---|---|
| **Form hosting is OURS** | Forms render on our servers. Client can embed, but the engine is ours. |
| **CRM sync engine is OURS** | We manage OAuth tokens, API rate limits, field mapping. Client can't replicate this. |
| **Badge generation is OURS** | PDF generation runs on our infrastructure. |
| **Webhook delivery is OURS** | Retry logic, delivery logs, error handling — all managed. |

### K4 — Data Advantage (The Hidden Moat)

| Mechanism | Strategic Value |
|---|---|
| **Form conversion benchmarks** | Across all users: "Contact forms convert at 3.2%, demo request forms at 8.1%." We can show users how they compare. Nobody else has this data. |
| **Qualification pattern library** | We learn which qualification questions correlate with closed deals. Better templates = better capture = more users. |
| **CRM field mapping intelligence** | We learn common mappings per CRM. New users get smart-suggested mappings on day 1. |

---

## DELIVERY MATRIX: V1 PLAN TIERS

| Capability | Starter ($49/mo) | Growth ($149/mo) | Pro ($299/mo) | Agency ($799/mo) |
|---|---|---|---|---|
| **Leads Captured** | 500/mo | 2,500/mo | 10,000/mo | 50,000/mo |
| **Forms** | 3 | 10 | Unlimited | Unlimited |
| **Badge Events** | 1 | 5 | Unlimited | Unlimited |
| **QR Codes** | ✓ | ✓ | ✓ | ✓ |
| **CRM Integrations** | 1 CRM | 2 CRMs | All CRMs | All CRMs |
| **CRM Syncs** | 500/mo | 2,500/mo | 10,000/mo | 50,000/mo |
| **Webhooks** | 1 endpoint | 3 endpoints | 10 endpoints | Unlimited |
| **Zapier** | ✖ | ✓ | ✓ | ✓ |
| **Qualification** | Basic (3 questions) | Full | Full | Full |
| **Analytics** | Basic | Full | Full + Export | Full + Export |
| **CSV Export** | ✓ | ✓ | ✓ | ✓ |
| **Form Templates** | 3 basic | Full library | Full library | Full library |
| **Badge Templates** | 1 basic | 5 templates | Custom | Custom |
| **Priority Support** | ✖ | ✖ | ✓ | ✓ + Dedicated |
| **Sub-Accounts** | ✖ | ✖ | ✖ | Up to 20 (V4) |
| **White-Label** | ✖ | ✖ | ✖ | ✓ (V4) |
| **API Access** | ✖ | ✖ | ✖ | ✓ (V4) |

---

## VISUAL: THE COMFORT/CONTROL BALANCE

```
COMFORT (Client loves it)                CONTROL (We need it)
◄──────────────────────────────────────────────────────────►

  Zero setup                               SaaS-only delivery
  Onboarding wizard                        Usage-based metering
  Self-service billing                     Form hosting ownership
  Data export (CSV)                        CRM sync engine ownership
  Pre-built form templates                 Badge generation ownership
  In-app guidance                          Feature gating by plan
  Mobile-responsive                        Webhook infrastructure
  Import from competitors                  Data advantage (benchmarks)
                                           Update control

  "Come in, it's easy!"                    "Stay, because we run the engine."
```
