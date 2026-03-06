# Lead Generation System — Feature Prioritization & Version Roadmap

> **Philosophy**: Capture real leads first. Integrate where they already work. Discover more leads later.
>
> A lead that FILLED OUT YOUR FORM has 10x more intent than a lead you SCRAPED from Google Maps. Build the capture engine first, the scraping engine second.

---

## THE STRATEGIC SHIFT

```
OLD APPROACH (WRONG):                    NEW APPROACH (RIGHT):
━━━━━━━━━━━━━━━━━━━━                    ━━━━━━━━━━━━━━━━━━━━

Scrape Google Maps                       Capture leads that COME TO YOU
      ↓                                        ↓
Extract emails from websites             Qualify them instantly
      ↓                                        ↓
Verify emails                            Push to CRM in real-time
      ↓                                        ↓
Send cold emails                         Nurture with outreach
      ↓                                        ↓
Hope they reply                          THEN discover more leads like them

PROBLEM: Unreliable data, fragile        ADVANTAGE: Real intent, real data,
scrapers, no trust in the pipeline.      trusted pipeline. Scraping ENHANCES
User types "dentists Miami" and          the system later — it doesn't
HOPES the system finds good leads.       define it.
```

**Why capture-first wins:**
- A form submission = a person who WANTS to talk to you. A scraped email = a guess.
- Badge scan at an event = verified contact with context. Google Maps result = a phone number with no relationship.
- CRM integration on day 1 = users don't need to change their workflow. They keep HubSpot/Salesforce and add us.
- Scraping is fragile (Google changes layouts, blocks IPs, rate-limits). Capture is under YOUR control.

---

# VERSION 1 — "THE CAPTURE ENGINE"

> **Core mission**: Capture leads from every touchpoint — forms, badges, QR codes, manual entry — qualify them, and push them to the user's CRM instantly.
>
> **Duration**: 6-8 weeks | **Revenue target**: First $1K MRR

---

## V1.F1 — Lead Capture System (PRIMARY — THE WHOLE POINT)

> This is what users pay for. Every way a lead can enter the system.

| # | Feature | How It Works | Why V1 |
|---|---|---|---|
| V1.F1.1 | **Embeddable Lead Forms** | User builds a form in our dashboard → gets an HTML embed code or hosted URL → places on their website → submissions flow into their lead database in real-time | This is the Captello model for digital. A form on a website is the #1 inbound lead capture method. Every business has a website. |
| V1.F1.2 | **Form Builder** | Drag-and-drop builder: name, email, phone, company, job title, custom fields, dropdown selectors, checkboxes, file upload. Conditional logic: show field B only if field A = X. | Users need different forms for different pages, campaigns, events. One-size-fits-all doesn't work. |
| V1.F1.3 | **QR Code Generation** | For any form, generate a unique QR code. Lead scans QR with phone → opens the form → submits → data flows in. Can be printed on business cards, booth banners, flyers, product packaging. | QR bridges physical-to-digital. At a trade show, networking event, or retail location — scan → capture. No app install required. |
| V1.F1.4 | **Badge Generation & Scanning** | Generate printable name badges with embedded QR/barcode for event attendees. Scan badge with phone camera → instantly pulls up attendee info → rep adds qualification notes → lead captured. | This is Captello's core feature. Events generate MASSIVE lead volume. A badge scan takes 2 seconds vs. typing an email manually. |
| V1.F1.5 | **Manual Lead Entry** | Quick-add form in dashboard: enter name, email, phone, company, notes, tags. Bulk entry mode for rapid input. | Sales reps collect leads on phone calls, at lunches, from business cards. They need a fast way to log them. |
| V1.F1.6 | **CSV/Excel Import** | Upload CSV/Excel → column mapping UI → preview → import. Handles duplicates (skip, merge, overwrite). | Users migrating from spreadsheets, other tools, or receiving lead lists from partners. Day-1 essential. |
| V1.F1.7 | **CSV Export** | Select leads or entire list → download as CSV with all fields. | Data portability builds trust. Paradoxically, letting users leave easily makes them more likely to stay. |
| V1.F1.8 | **Real-Time Qualification** | When a lead is captured (form, badge, manual), trigger a qualification mini-survey: budget, timeline, interest level, product fit. Score captured automatically. | Raw leads aren't equal. A form submission from a CEO with a $100K budget ≠ a student doing homework. Qualification at the moment of capture is priceless — Captello's killer feature. |
| V1.F1.9 | **Capture Source Tracking** | Every lead is tagged with HOW and WHERE it was captured: which form, which QR code, which badge event, manual entry, CSV import. UTM parameter parsing for web forms. | Attribution answers "which capture method brings the best leads?" Without this, you're blind. |
| V1.F1.10 | **Webhook on Capture** | When a lead is captured via any method, fire a webhook to a configurable URL with the full lead payload (JSON). | Even before full CRM integration, users can pipe captured leads to Zapier, Make, their own backend, Slack, etc. Instant value without waiting for native integrations. |

**Abstract operation — how capture works end-to-end:**
```
CAPTURE FLOW (any source):

  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │  WEB FORM   │   │  QR CODE    │   │  BADGE SCAN │   │  MANUAL /   │
  │  (embed or  │   │  (scanned   │   │  (phone     │   │  CSV IMPORT │
  │   hosted)   │   │   by phone) │   │   camera)   │   │             │
  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
         │                 │                 │                 │
         └────────┬────────┴────────┬────────┘                 │
                  ▼                 ▼                           │
         ┌───────────────────────────────┐                     │
         │  CAPTURE API ENDPOINT         │◄────────────────────┘
         │  POST /api/capture            │
         │                               │
         │  • Validates required fields   │
         │  • Deduplicates (email match) │
         │  • Tags with source + UTM     │
         │  • Triggers qualification      │
         │    (if configured)             │
         │  • Fires webhook               │
         └──────────┬────────────────────┘
                    │
                    ▼
         ┌───────────────────────────────┐
         │  LEAD DATABASE                │
         │                               │
         │  Stored with:                 │
         │  • All submitted fields       │
         │  • Capture source + timestamp │
         │  • Qualification score        │
         │  • UTM parameters             │
         │  • Device/browser info        │
         └──────────┬────────────────────┘
                    │
              ┌─────┴─────┐
              ▼           ▼
    ┌──────────────┐  ┌──────────────┐
    │ CRM SYNC     │  │  WEBHOOK     │
    │ (V1.F2)      │  │  PUSH        │
    │ HubSpot,     │  │  (real-time) │
    │ Salesforce,  │  │              │
    │ etc.         │  │              │
    └──────────────┘  └──────────────┘
```

---

## V1.F2 — CRM Integrations (PUSH LEADS WHERE USERS ALREADY WORK)

> Users don't want to live in our dashboard. They live in HubSpot, Salesforce, Pipedrive. We capture leads and PUSH them there instantly.

| # | Feature | How It Works | Why V1 |
|---|---|---|---|
| V1.F2.1 | **HubSpot Integration** | OAuth connection → map our fields to HubSpot contact properties → auto-push new captured leads as HubSpot contacts. Create deals/notes from qualification data. | HubSpot has 200K+ customers and a free CRM tier. Massive addressable market. |
| V1.F2.2 | **Salesforce Integration** | OAuth connection → push leads as Salesforce Lead/Contact objects. Field mapping UI. Support for custom fields and record types. | Enterprise standard. Opens up bigger clients, agencies, and teams. |
| V1.F2.3 | **Pipedrive Integration** | OAuth connection → push leads as Pipedrive persons/deals. | Pipedrive is popular with SMBs and sales-focused teams. |
| V1.F2.4 | **Generic Webhook Push** | On any event (lead captured, lead qualified, lead updated), POST JSON payload to any URL. Configurable events, retry on failure, delivery log. | Universal integration. Works with ANY system that accepts HTTP. Zapier, Make, n8n, custom backends. |
| V1.F2.5 | **Zapier Connector** | Triggers: "New Lead Captured", "Lead Qualified", "Lead Updated". Actions: "Create Lead", "Update Lead". | 5,000+ app integrations without us building each one. Users who can't code still connect everything. |
| V1.F2.6 | **Integration Field Mapping** | UI to map our lead fields → CRM fields. Save mapping templates. Different mappings per form/capture source. | Every CRM has different field names. "Company" in ours might be "Organization" in Pipedrive. Users need control. |
| V1.F2.7 | **Sync Status Dashboard** | Per-lead: "Synced to HubSpot ✓", "Salesforce push failed ✖ — retry". Per-integration: success rate, last sync, error count. | Users need to trust that data is flowing. If a sync fails silently, they lose trust immediately. |

**Abstract operation — how CRM sync works:**
```
CRM SYNC FLOW:

  Lead Captured (any source)
         │
         ▼
  ┌────────────────────────────────┐
  │  INTEGRATION ENGINE            │
  │                                │
  │  1. Check: which integrations  │
  │     are active for this user?  │
  │                                │
  │  2. For each active CRM:      │
  │     a. Load field mapping      │
  │     b. Transform lead data     │
  │        to CRM format           │
  │     c. Push via CRM API        │
  │     d. Log result (success     │
  │        or error + retry)       │
  │                                │
  │  3. Fire webhooks (if any)     │
  └────────────────────────────────┘
         │
    ┌────┼────┬────────┐
    ▼    ▼    ▼        ▼
  [HS] [SF] [PD]   [Webhook]
  
  HS = HubSpot API (POST /contacts)
  SF = Salesforce API (POST /sobjects/Lead)
  PD = Pipedrive API (POST /persons)
```

---

## V1.F3 — Lead Management (THE DATABASE)

> Every captured lead lives here. Search, filter, organize, act.

| # | Feature | How It Works | Why V1 |
|---|---|---|---|
| V1.F3.1 | **Lead Database** | All captured/imported leads in a searchable, sortable table. Columns: name, email, phone, company, source, score, status, tags, date captured. | The core data view. Without a usable database, nothing else matters. |
| V1.F3.2 | **Lead Lists** | User-created named lists. A lead can belong to multiple lists. Lists used for organization, segmentation, and (later) campaigns. | Organize leads by event ("SXSW 2026"), by source ("Website Contact Form"), by segment ("Enterprise Prospects"). |
| V1.F3.3 | **Tags & Labels** | Custom text tags per lead: "hot", "follow-up", "CEO", "event-austin". Bulk-add/remove tags. Filter by tag. | Flexible, freeform categorization. Users love tags because they adapt to any workflow. |
| V1.F3.4 | **Search & Filter** | Filter by: any field, tag, capture source, qualification score, status, list membership, date range. Full-text search across all fields. | With thousands of leads, finding the right ones fast is essential. |
| V1.F3.5 | **Deduplication** | On capture/import: match by email. Options: skip duplicate, merge (keep newest data), overwrite. Duplicate report. | Same person fills out 2 forms, or is imported twice. Duplicates contaminate data and cause embarrassment. |
| V1.F3.6 | **Lead Detail View** | Click any lead → full profile page. All fields, all notes, capture history, qualification answers, CRM sync status, campaign history (when V2 outreach exists). | One page to see everything about a lead. The "command center" per lead. |
| V1.F3.7 | **Notes** | Free-text notes per lead. Timestamped. Multiple notes. "Called on 3/1, interested in Pro plan, follow up Friday." | Sales context. Without notes, reps forget conversations and leads go cold. |
| V1.F3.8 | **Lead Status Pipeline** | Configurable status stages: New → Contacted → Qualified → Meeting Booked → Won / Lost. Manual or auto-updated. A simple Kanban column view. | Visual pipeline shows WHERE every lead is in the process. Even before outreach exists, users manually move leads through stages. |
| V1.F3.9 | **Bulk Actions** | Select multiple leads → add to list, add tag, change status, export, delete. | Managing leads one-by-one doesn't scale. After an event with 500 badge scans, bulk actions are essential. |
| V1.F3.10 | **Blacklist** | Add email or domain to global exclusion list. Blacklisted leads are never captured, never emailed. | Competitors, spam submitters, ex-clients who said "never contact me again." |

---

## V1.F4 — Analytics Dashboard

| # | Feature | What It Shows | Why V1 |
|---|---|---|---|
| V1.F4.1 | **Capture Overview** | Total leads captured today / this week / this month. Breakdown by source: forms vs. badges vs. QR vs. manual vs. import. | The #1 question: "How many leads are we getting?" |
| V1.F4.2 | **Form Performance** | Per-form: views, submissions, conversion rate. Which form converts best? | Users have multiple forms. They need to know which one works and which needs fixing. |
| V1.F4.3 | **Source Attribution** | Which capture source (form A, QR code B, badge event C) produces the highest-quality leads (by qualification score)? | Quantity ≠ quality. 100 badge scans with 5% qualified vs. 20 form fills with 40% qualified. |
| V1.F4.4 | **CRM Sync Health** | Integration success/failure rates. Leads pending sync, failed sync (with retry). Data freshness. | Users need to trust the pipeline. A "98.5% sync success rate" builds confidence. |
| V1.F4.5 | **Daily/Weekly Trend** | Time-series chart: leads captured per day, by source. Overlay qualification rate. | "Are we growing?" answered with one chart. |
| V1.F4.6 | **Account Usage** | Leads captured / plan limit. Forms created / plan limit. CRM syncs / plan limit. | Usage transparency. Drives upgrades when they approach limits. |

---

## V1.F5 — Security, Auth & Billing

> The security module underlies every other module in the modular monolith. It is built first and built completely. Auth method is invisible to all other modules — they only receive a typed `AuthenticatedUser` object from the security module's public interface.

```
V1 AUTH HIERARCHY:
  PRIMARY  → Passkeys (WebAuthn / FIDO2)
  FALLBACK → OAuth 2.1 + PKCE + mandatory TOTP MFA  (Google, Microsoft)

  BANNED:  bcrypt for passwords, OAuth 2.0, SMS OTP, any MFA bypass
  V2 ADDS: Email + Password + Argon2id + pepper + mandatory TOTP MFA (last resort)
```

| # | Feature | Details | Why V1 |
|---|---|---|---|
| V1.F5.1 | **Passkey Registration** | WebAuthn key pair generated on device. Private key in Secure Enclave/TPM, public key stored in DB. Domain-bound — phishing-proof. | Most secure auth method available. No password exists to crack or steal. |
| V1.F5.2 | **Passkey Login** | Server issues challenge → device signs with private key → server verifies vs. stored public key → session issued. Zero secret over the wire. | Zero phishable credential. GPU attacks are irrelevant — there's no hash. |
| V1.F5.3 | **Multi-Device Passkey Management** | Register multiple passkeys per account. Name, view, remove from security settings. | Users have multiple devices. Lock-out prevention. |
| V1.F5.4 | **OAuth 2.1 + PKCE (Google / Microsoft)** | PKCE mandatory (`code_challenge = SHA256(verifier)`). Exact URI matching. Short-lived codes (60s). Refresh token rotation on every use. 15-min access token expiry. | Covers users whose devices don't support passkeys. All OAuth 2.0 dangerous patterns explicitly banned. |
| V1.F5.5 | **Mandatory TOTP MFA (OAuth path)** | TOTP challenge required after OAuth callback before session issued. Authenticator app only. No SMS. No email OTP. Cannot skip. Enrollment triggered on first login. | OAuth gives identity confirmation, not proof of session ownership. MFA adds the second factor. |
| V1.F5.6 | **MFA Recovery Codes** | 8 single-use codes generated at enrollment. Shown once. Each invalidated on use. Regeneration requires current TOTP. | Device loss cannot permanently lock a user out. |
| V1.F5.7 | **Server-Side Redis Sessions** | On auth success: 256-bit random session ID → Redis `{userId, planId, ip, deviceFingerprint, createdAt, lastActiveAt}` + TTL → `HttpOnly; Secure; SameSite=Strict` cookie. Logout = `DEL` in Redis → immediately dead. No JWT stored client-side. | Logout is instant and real. Compromised token revocable in one operation. No expiry window for attackers. |
| V1.F5.8 | **Adaptive Risk Assessment** | Score every login: IP reputation, device fingerprint (new?), impossible travel, time pattern, failed history. LOW → proceed. MEDIUM → re-trigger MFA. HIGH → force re-auth + alert email. CRITICAL → account lock. | Catches stolen sessions, credential stuffing, and account takeover attempts automatically. |
| V1.F5.9 | **Rate Limiting (Auth)** | `/auth/*`: 10 req/15min/IP with exponential backoff. Separate Redis counters per endpoint. | Brute-force prevention at the entry point. |
| V1.F5.10 | **Security Settings Page** | List passkeys (add/remove). List active sessions (remote revoke). MFA status + backup code regeneration. Last 10 security events (login, IP, method). | Users must be able to audit and control their own security posture. |
| V1.F5.11 | **Subscription Plans** | 3-4 tiers via Stripe Checkout. Differentiated by: lead capture limits, form count, CRM integrations, analytics depth. | Business model. |
| V1.F5.12 | **Plan Upgrade/Downgrade** | Self-service via Stripe Customer Portal. | Self-service is a Comfort position. |
| V1.F5.13 | **Usage Tracking** | Real-time: leads captured / limit, forms / limit, CRM syncs / limit. | Transparency builds trust. Drives upgrades. |
| V1.F5.14 | **Invoices** | Auto-generated by Stripe, viewable in app. | Required for business customers. |
| V1.F5.15 | **Plan Guard** | Block capture/form creation when limits exceeded. Show upgrade prompt. | Prevents abuse, drives revenue. |

---

## V1 FEATURE COUNT SUMMARY

| Module | Features | Complexity |
|---|---|---|
| Lead Capture System | 10 | HIGH (forms engine, QR gen, badge system, qualification, webhooks) |
| CRM Integrations | 7 | HIGH (3 OAuth CRM APIs + webhook + Zapier) |
| Lead Management | 10 | MEDIUM (CRUD + UI + pipeline) |
| Analytics Dashboard | 6 | LOW-MEDIUM (read-only aggregation) |
| Security, Auth & Billing | 15 | HIGH (WebAuthn, OAuth 2.1+PKCE, TOTP MFA, Redis sessions, risk engine, Stripe) |
| **TOTAL** | **48** | **~6-8 weeks for experienced dev** |

---
---

# VERSION 2 — "THE OUTREACH ENGINE"

> **Core mission**: Now that leads are captured and flowing to CRMs, let users REACH OUT to those leads directly from our platform. Email sequences, verification, and tracking.
>
> **Duration**: 4-6 weeks | **Revenue target**: $5K MRR

---

## V2.F0 — Security Addendum: Email + Password Fallback (Last Resort)

> The V1 auth hierarchy (Passkeys → OAuth 2.1 + MFA) covers the vast majority of users. V2 adds the third and final fallback for users who refuse both. It is made deliberately less prominent in the UI to discourage its use.

| # | Feature | Details |
|---|---|---|
| V2.F0.1 | **Email + Password Registration** | Password hashed with Argon2id (`m=65536`, `t=3`, `p=4`, 16-byte random salt, 32-byte output). Server-side pepper: `hash = Argon2id(HMAC-SHA256(password, PEPPER), salt)` — pepper lives in env vars, NOT in DB. DB breach alone is useless without the pepper. |
| V2.F0.2 | **Email Verification** | HMAC-SHA256 signed token (24h TTL). Account inactive until verified. |
| V2.F0.3 | **Password Login + mandatory TOTP MFA** | Email + password → valid → TOTP challenge → session issued. No bypass path. Same TOTP service used by OAuth path. |
| V2.F0.4 | **Password Reset** | Signed time-limited token (15 min TTL). Single-use. Invalidates ALL existing sessions on completion. |
| V2.F0.5 | **HaveIBeenPwned Check** | On login: check password against HIBP k-anonymity API (sends only first 5 chars of SHA1 hash — password never transmitted). If breached → force reset before session issued. |

---

## V2.F1 — Email Verification

> Before sending any email, verify it's real. This applies to ALL leads — captured via forms, imported via CSV, or (later) scraped.

| # | Feature | How It Works | Why V2 |
|---|---|---|---|
| V2.F1.1 | **Single Email Verify** | Enter one email → MX check → SMTP handshake → catch-all detection → disposable filter → result: Valid / Invalid / Risky / Unknown | Users capture leads via forms — but form emails can be fake. Verification adds trust layer. |
| V2.F1.2 | **Bulk Verify** | Select a list or all leads → queue verification → each lead tagged with result | After an event with 300 badge scans, bulk-verify all captured emails before outreach. |
| V2.F1.3 | **MX Record Check** | Check if domain has valid mail servers before SMTP handshake | First filter — if no MX record, the domain doesn't accept email at all. |
| V2.F1.4 | **SMTP Handshake** | Connect to mail server, simulate sending, check if mailbox exists — without actually sending | The real verification step. Does john@company.com exist? |
| V2.F1.5 | **Catch-All Detection** | Detect domains that accept ALL addresses (can't truly verify individual emails) | Prevent false positives. Mark as "Risky" so users know. |
| V2.F1.6 | **Disposable Email Filter** | Check against known disposable email providers (guerrillamail, tempmail, etc.) | Form submissions often include throwaway emails. Filter them. |
| V2.F1.7 | **Auto-Verify on Capture** | Optionally: when a lead is captured via form/import, auto-queue email verification | Seamless — leads arrive pre-verified without manual action. |
| V2.F1.8 | **Verification Cache** | Previously verified email → return cached result (7-day TTL) | Don't re-verify the same email twice. Saves time and server resources. |

---

## V2.F2 — Cold Email Outreach

> Users have captured leads, qualified them, pushed them to CRM. Now they want to email the ones that didn't convert to meetings automatically.

| # | Feature | How It Works | Why V2 |
|---|---|---|---|
| V2.F2.1 | **Email Account Connection** | Connect Gmail (OAuth), Outlook (OAuth), or custom SMTP credentials. Test connection on save. | Emails must send FROM the user's own account for deliverability and reputation. |
| V2.F2.2 | **Sequence Builder** | Visual builder: Step 1 (subject + body) → wait X days → Step 2 → wait Y days → Step 3... Up to 7 steps. | Multi-touch follow-up is how cold email works. 80% of replies come after step 2-4. |
| V2.F2.3 | **Personalization Variables** | `{first_name}`, `{company}`, `{job_title}`, `{capture_source}`, `{qualification_score}` in subject + body, auto-filled per lead | Personalized emails get 5-15% reply rates vs 1% for generic. |
| V2.F2.4 | **Campaign Launch** | Select sequence + lead list + email account + schedule → launch. Emails queued and sent on schedule. | The activation moment. Leads become conversations. |
| V2.F2.5 | **Timezone-Aware Scheduling** | Send at 9am in the LEAD's timezone (inferred from location/phone area code) | Open rates: 30-50% at 9am local time vs 15-20% at random times. |
| V2.F2.6 | **Daily Sending Limits** | Per-account limit (Gmail: 50/day recommended, Outlook: 80/day). System enforces, resumes next day. | Sending 500 emails from a fresh Gmail = instant spam folder. Limits protect the user's reputation. |
| V2.F2.7 | **Open Tracking** | Invisible tracking pixel in each email. Records: who opened, when, how many times, device/email client. | "Did they read my email?" is the #1 question after sending. |
| V2.F2.8 | **Click Tracking** | Links in emails replaced with redirect URLs. Records: who clicked, which link, when. | "Did they click my pricing page?" tells you way more than "did they open." |
| V2.F2.9 | **Reply Detection** | IMAP connection reads the connected inbox. Detects replies to tracked emails. Matches reply to lead + campaign. | Users need replies in the platform, not scattered across Gmail tabs. |
| V2.F2.10 | **Auto-Stop on Reply** | When a lead replies to any step in a sequence, all remaining steps are paused for that lead. | Prevents: "Thanks for your reply!" followed by an automated "just following up..." 2 days later. Embarrassing. |
| V2.F2.11 | **Unsubscribe Link** | Auto-inserted in every outgoing email. One-click unsubscribe → lead marked as Do-Not-Contact. | CAN-SPAM compliance. Non-negotiable for deliverability. |
| V2.F2.12 | **Bounce Handling** | SMTP error codes classify bounces. Hard bounce → auto-remove from list. Soft bounce → track, retry once. | Hard bounces damage sender reputation. Auto-removal protects the user. |
| V2.F2.13 | **Campaign Controls** | Pause / Resume / Stop entire campaign. Per-lead: exclude, skip, reschedule. | Users need control without diving into code. |

---

## V2.F3 — Campaign Analytics

> Metrics for the outreach engine.

| # | Feature | What It Shows | Why V2 |
|---|---|---|---|
| V2.F3.1 | **Campaign Overview** | Sent / Delivered / Opened / Clicked / Replied / Bounced — counts and rates. | Core email metrics. |
| V2.F3.2 | **Per-Step Breakdown** | Metrics for each step in a sequence. "Step 1: 45% open, 3% reply. Step 3: 22% open, 8% reply." | Which step is performing? Where are people dropping off? |
| V2.F3.3 | **Daily Activity Chart** | Time-series: emails sent + events per day over last 30/60/90 days. | Trend analysis — "are my campaigns improving?" |

---

## V2.F4 — Enhanced Lead Features

| # | Feature | How It Works | Why V2 |
|---|---|---|---|
| V2.F4.1 | **Lead Scoring** | Engagement scoring: +10 open, +25 click, +50 reply. Combined with qualification score from capture. | "Show me my hottest leads" — one number. Prioritize outreach. |
| V2.F4.2 | **Unified Inbox** | All email replies across all connected accounts, in one view. Tag: Interested / Not Interested / OOO / Referral. | Without this, users check 5 Gmail tabs manually. |
| V2.F4.3 | **Calendar Booking Link** | Simple scheduling page. Lead clicks → picks a time → meeting booked. Embeddable in email sequences. | Lead replies "interested" — where do they book? This closes the loop without Calendly. |
| V2.F4.4 | **Email Template Library** | Pre-built sequences for common niches: SaaS sales, real estate, agency outreach, event follow-up, etc. | New users can launch a campaign in 5 minutes instead of staring at a blank page. |

---

## V2 FEATURE COUNT SUMMARY

| Module | Features | Complexity |
|---|---|---|
| Email Verification | 8 | MEDIUM (SMTP/DNS) |
| Cold Email Outreach | 13 | HIGH (queue, tracking, IMAP) |
| Campaign Analytics | 3 | LOW (aggregation) |
| Enhanced Lead Features | 4 | MEDIUM |
| **TOTAL** | **28** | **~4-6 weeks** |

---
---

# VERSION 3 — "THE DISCOVERY ENGINE"

> **Core mission**: NOW add scraping and enrichment. Users have a working capture + outreach platform. Discovery finds MORE leads to feed into the same pipeline.
>
> **Duration**: 6-8 weeks | **Revenue target**: $15K MRR

---

## V3.F1 — Lead Discovery (Scraping)

> This is the module that was previously V1. Now it's an ENHANCEMENT — it feeds leads into the same capture pipeline, same CRM sync, same outreach engine.

| # | Feature | How It Works | Why V3 (not V1) |
|---|---|---|---|
| V3.F1.1 | **Google Maps Scraper** | User enters query + location ("dentists in Miami") → system scrapes Google Maps → returns businesses with name, address, phone, website, rating, hours. Results auto-imported into lead database. | Useful for local business prospecting. But it's an ADDITION to capture, not a replacement. Users who already capture 200 leads/month from forms now want 500 more from scraping. |
| V3.F1.2 | **Google Search Scraper** | User enters query ("AI consulting firms New York") → system scrapes organic search results → returns URLs + titles + descriptions. | Covers SaaS, agencies, freelancers, online-only businesses that don't have Google Maps listings. |
| V3.F1.3 | **Website Email Extractor** | Given a domain (from Maps/Search results OR manually entered), crawl /contact, /about, /team pages → extract all email addresses. | The bridge from "I found a company" to "I have their email." |
| V3.F1.4 | **Email Pattern Detector** | Given a domain + one known employee name → detect the email pattern (first.last@, f.last@, first@) → generate emails for other names found on the site. | When crawling doesn't find direct emails, pattern detection fills the gap. |
| V3.F1.5 | **Auto-Extract Pipeline** | After Maps/Search returns results with websites → auto-queue email extraction for all domains → auto-verify all found emails → results land in lead database tagged as "scraped." | One-click: search → extract → verify → ready. The full pipeline users expect from Apollo/Hunter. |
| V3.F1.6 | **Bulk Discovery Queue** | Multiple queries batched ("dentists" in 10 cities, or 20 different keyword+location combos). Processed sequentially, results merged. | Power users don't search one city at a time. |

**Abstract operation — how discovery feeds into the existing system:**
```
V3 DISCOVERY feeds into V1+V2 pipeline:

  User: "marketing agencies in Chicago"
         │
         ▼
  ┌────────────────────┐
  │  DISCOVERY ENGINE   │
  │  (Google Maps +     │
  │   Google Search)    │
  └────────┬───────────┘
           │
           ▼
  ┌────────────────────┐
  │  EXTRACTION         │
  │  (crawl websites,   │
  │   find emails,      │
  │   detect patterns)  │
  └────────┬───────────┘
           │
           ▼
  ┌────────────────────┐         ┌─────────────────────────────┐
  │  SAME LEAD DB      │────────►│  SAME CRM SYNC (V1.F2)     │
  │  as captured leads  │        │  HubSpot, Salesforce, etc.  │
  │  (tagged "scraped") │        └─────────────────────────────┘
  └────────┬───────────┘
           │
           ▼
  ┌────────────────────┐
  │  SAME OUTREACH     │
  │  ENGINE (V2.F2)    │
  │  Email sequences   │
  └────────────────────┘

Key insight: Discovery is just another CAPTURE SOURCE.
Scraped leads enter the same pipeline as form submissions.
```

---

## V3.F2 — Lead Enrichment

> Given a lead (from ANY source), enhance it with additional data.

| # | Feature | How It Works | Why V3 |
|---|---|---|---|
| V3.F2.1 | **Company Enrichment** | Given a domain → get company size, industry, revenue range, tech stack, founding year, location. Sources: Clearbit-style APIs or custom scraping. | Turns "john@acme.com" into "John at Acme Corp, 50-200 employees, SaaS, $5M revenue, uses React + AWS." |
| V3.F2.2 | **Social Profile Linking** | Given name + company → auto-find LinkedIn, Twitter/X profiles. | Multi-channel context. Reps can check LinkedIn before emailing. |
| V3.F2.3 | **Phone Number Finder** | Given name + company → find direct dial or mobile number from public sources. | For users who combine email outreach with phone calls. |
| V3.F2.4 | **Job Title Normalization** | "VP of Mktg" → "Vice President of Marketing". Consistent formatting for filtering and segmentation. | Clean data enables accurate filtering. |
| V3.F2.5 | **Waterfall Enrichment** | Try enrichment source A → if no result → source B → source C. Charge only for found data. | Maximize data found while minimizing credit waste. |

---

## V3.F3 — Advanced Outreach Features

| # | Feature | How It Works | Why V3 |
|---|---|---|---|
| V3.F3.1 | **A/B Testing** | Test 2 variants of any step in a sequence. System splits recipients 50/50, measures open/reply rates. | Data-driven optimization for power users. |
| V3.F3.2 | **Conditional Branching** | "If opened but didn't reply → send variant B." "If clicked pricing link → send case study." | Smart sequences that adapt to recipient behavior. |
| V3.F3.3 | **Multi-Sender Rotation** | Rotate sending between 3-5 email accounts per campaign. | Spread volume across accounts, protect each account's reputation. |
| V3.F3.4 | **Email Warm-Up** | Automated warm-up: simulate real email activity between warm-up network accounts to build sender reputation. | New email accounts land in spam. 2-4 weeks of warm-up fixes this. |
| V3.F3.5 | **Domain Health Monitor** | Track SPF/DKIM/DMARC status, blacklist alerts, sending reputation score per connected account. | Proactive warnings before deliverability dies. |

---

## V3.F4 — AI Features (Phase 1)

| # | Feature | How It Works | Why V3 |
|---|---|---|---|
| V3.F4.1 | **AI Email Writer** | Given lead data (name, company, industry, qualification score), generate a personalized cold email. | Removes blank-page fear. Users get a draft in seconds. |
| V3.F4.2 | **AI Subject Line Generator** | Generate 5 subject line variants for A/B testing. | Subject lines make or break open rates. |
| V3.F4.3 | **AI Icebreaker Generator** | Pull recent news/LinkedIn activity for a lead → generate a personalized opening line. | Makes emails feel 1-to-1 instead of mass-blasted. |
| V3.F4.4 | **AI Reply Classification** | When a reply comes in, AI auto-classifies: Interested / Not Interested / OOO / Referral / Do Not Contact. | Users don't manually read 200 replies to find the 15 interested ones. |

---

## V3 FEATURE COUNT SUMMARY

| Module | Features | Complexity |
|---|---|---|
| Lead Discovery (Scraping) | 6 | HIGH (scraping engine, proxy management) |
| Lead Enrichment | 5 | MEDIUM (3rd-party APIs) |
| Advanced Outreach | 5 | MEDIUM-HIGH (warm-up network, branching logic) |
| AI Features (Phase 1) | 4 | MEDIUM (LLM API integration) |
| **TOTAL** | **20** | **~6-8 weeks** |

---
---

# VERSION 4 — "THE EMPIRE"

> **Core mission**: Scale the platform with team features, white-label, marketplace, advanced AI, and enterprise compliance. This is the moat.
>
> **Duration**: 8-12 weeks | **Revenue target**: $50K+ MRR

---

## V4.F1 — Team & Workspace Features

| # | Feature | How It Works | Why V4 |
|---|---|---|---|
| V4.F1.1 | **Multi-User Workspaces** | Invite team members. Shared lead database, shared campaigns, shared CRM connections. | Agencies have 3-10 people. Solo founders grow into teams. |
| V4.F1.2 | **Role-Based Permissions** | Admin / Manager / Member. Control who can: create forms, launch campaigns, export data, manage billing. | Security and organization for teams. |
| V4.F1.3 | **Lead Assignment** | Assign leads to specific team members. Round-robin auto-assignment. | Prevents two reps emailing the same lead. |
| V4.F1.4 | **Team Analytics** | Per-member: leads captured, emails sent, replies received, meetings booked. | Performance management for team leads. |

---

## V4.F2 — White-Label & Agency

| # | Feature | How It Works | Why V4 |
|---|---|---|---|
| V4.F2.1 | **Custom Branding** | Agency logo, colors, custom domain. Clients see the agency's brand, not ours. | Agencies pay 3-5x more for white-label. Our tool becomes invisible infrastructure. |
| V4.F2.2 | **Sub-Accounts** | Each agency client gets an isolated workspace with separate forms, leads, campaigns. | Agencies manage 10-50 clients. Each sub-account = recurring revenue. |
| V4.F2.3 | **Agency Billing** | Agency pays us one price → charges their clients whatever they want. | Guaranteed revenue. Agency gets margin. |
| V4.F2.4 | **Client Reporting** | White-labeled PDF reports: leads captured, campaigns sent, meetings booked — with agency branding. | Agencies NEED proof-of-work reports for clients. |

---

## V4.F3 — Multi-Channel Outreach

| # | Feature | How It Works | Why V4 |
|---|---|---|---|
| V4.F3.1 | **LinkedIn Semi-Automation** | Auto-visit profiles, send connection requests with notes, InMail follow-ups. | LinkedIn is #2 outreach channel after email. Currently users pay $50-100/mo for Expandi/Dux-Soup separately. |
| V4.F3.2 | **SMS Integration** | Send SMS follow-ups via Twilio. Triggered by campaign events or manual. | High-urgency: local businesses, real estate, event follow-ups. |
| V4.F3.3 | **WhatsApp Business API** | Templated WhatsApp messages. | Dominant in EMEA, LATAM, APAC markets. |

---

## V4.F4 — Advanced AI & Marketplace

| # | Feature | How It Works | Why V4 |
|---|---|---|---|
| V4.F4.1 | **AI Campaign Builder** | "I sell SEO to dentists in Texas" → AI builds: ICP, lead list, email sequence, schedule. One sentence → running campaign. | Maximum automation. Nobody does this well yet. |
| V4.F4.2 | **AI Lead Scoring (ML)** | ML model trained on YOUR users' conversion data. Gets smarter over time. Network effect. | More users → better model → more accurate → more users. |
| V4.F4.3 | **Lookalike Finder** | "Find 500 companies like my best 10 clients." | Turns customer success data into new discovery. |
| V4.F4.4 | **Sequence Marketplace** | Users share/sell their best-performing email sequences. | Community creates content for us. |
| V4.F4.5 | **Form Template Marketplace** | Users share/sell high-converting form designs per niche. | Onboarding in seconds with a proven template. |

---

## V4.F5 — Compliance & Enterprise

| # | Feature | How It Works | Why V4 |
|---|---|---|---|
| V4.F5.1 | **GDPR Module** | Consent tracking, data processing records, right-to-erasure workflows. | Opens European market. Enterprise requirement. |
| V4.F5.2 | **Audit Logs** | Full activity log: who did what, when. Per user, per action.  | Enterprise compliance teams demand this. |
| V4.F5.3 | **SSO/SAML** | Single sign-on via Okta, Azure AD, Google Workspace. | Gate to $500+/mo enterprise accounts. |
| V4.F5.4 | **Public API + Docs** | REST API with full documentation, API keys, rate limits, usage metering. | Developers build on our platform → ecosystem moat. |
| V4.F5.5 | **Advanced Form Analytics** | Form conversion funnels, drop-off analysis, A/B test form variants. | Optimize capture beyond basic metrics. |

---

## V4 FEATURE COUNT SUMMARY

| Module | Features | Complexity |
|---|---|---|
| Team & Workspace | 4 | MEDIUM (RBAC, multi-tenant) |
| White-Label & Agency | 4 | HIGH (multi-tenant branding, isolation) |
| Multi-Channel Outreach | 3 | HIGH (LinkedIn automation, Twilio) |
| Advanced AI & Marketplace | 5 | HIGH (ML, marketplace infra) |
| Compliance & Enterprise | 5 | MEDIUM (GDPR workflows, SSO) |
| **TOTAL** | **21** | **~8-12 weeks** |

---
---

# COMPLETE VERSION MAP — ALL FEATURES AT A GLANCE

| Feature | Version | Module | Abstract Operation |
|---|---|---|---|
| Embeddable Lead Forms | **V1** | Capture | HTML embed/hosted URL → form submission → lead in database |
| Form Builder (drag-and-drop) | **V1** | Capture | Visual editor → custom fields, logic, styling → generate embed |
| QR Code Generation | **V1** | Capture | Per-form unique QR → scan with phone → opens form → submits |
| Badge Generation & Scanning | **V1** | Capture | Generate printable badge with QR/barcode → scan at event → lead captured |
| Manual Lead Entry | **V1** | Capture | Dashboard quick-add form → lead saved |
| CSV Import/Export | **V1** | Capture | Upload CSV → map columns → import. Select leads → download CSV. |
| Real-Time Qualification | **V1** | Capture | On capture → trigger qualification questions → score stored with lead |
| Capture Source Tracking | **V1** | Capture | Every lead auto-tagged: which form, QR, badge, UTM params |
| Webhook on Capture | **V1** | Capture | Lead captured → POST JSON to configured URL |
| HubSpot Integration | **V1** | CRM | OAuth → field mapping → auto-push leads as HubSpot contacts |
| Salesforce Integration | **V1** | CRM | OAuth → field mapping → auto-push leads as Salesforce objects |
| Pipedrive Integration | **V1** | CRM | OAuth → field mapping → auto-push leads as Pipedrive persons |
| Generic Webhook Push | **V1** | CRM | On events → POST JSON to any URL → retry on failure |
| Zapier Connector | **V1** | CRM | Triggers + Actions for 5000+ app integrations |
| Field Mapping UI | **V1** | CRM | Map our fields → CRM fields. Save templates per integration. |
| CRM Sync Dashboard | **V1** | CRM | Per-lead sync status, per-integration health metrics |
| Lead Database | **V1** | Management | Searchable, sortable table of all leads |
| Lead Lists & Tags | **V1** | Management | Named lists + freeform tags for organization |
| Search & Filter | **V1** | Management | Filter by any field, tag, source, score, date |
| Deduplication | **V1** | Management | Match by email on capture/import. Skip/merge/overwrite. |
| Lead Detail View | **V1** | Management | Full profile page per lead |
| Notes | **V1** | Management | Timestamped free-text notes per lead |
| Lead Status Pipeline | **V1** | Management | Configurable stages: New → Contacted → Won/Lost. Kanban view. |
| Bulk Actions | **V1** | Management | Multi-select → tag, list, status, export, delete |
| Blacklist | **V1** | Management | Email/domain exclusion list |
| Capture Analytics | **V1** | Analytics | Total captured, by source, conversion rates |
| CRM Sync Health | **V1** | Analytics | Sync success/failure rates, pending/failed syncs |
| Account Usage | **V1** | Analytics | Leads / limit, forms / limit, syncs / limit |
| Auth + Billing | **V1** | Platform | Passkeys (WebAuthn) PRIMARY → OAuth 2.1+PKCE+TOTP MFA FALLBACK → Redis sessions → risk engine → Stripe plans |
| ─── | ─── | ─── | ─── |
| Email Verification (8 features) | **V2** | Verification | MX → SMTP → catch-all → disposable → Valid/Invalid/Risky/Unknown |
| Cold Email Outreach (13 features) | **V2** | Outreach | Sequences, scheduling, tracking, reply detection, auto-stop |
| Campaign Analytics | **V2** | Analytics | Sent/opened/clicked/replied/bounced per campaign and per step |
| Lead Scoring | **V2** | Management | Qualification score + engagement score = priority number |
| Unified Inbox | **V2** | Outreach | All replies across all accounts in one view |
| Calendar Booking | **V2** | Outreach | Scheduling page embeddable in emails |
| Email Templates | **V2** | Outreach | Pre-built sequences per niche |
| ─── | ─── | ─── | ─── |
| Google Maps Scraper | **V3** | Discovery | Query + location → businesses with websites |
| Google Search Scraper | **V3** | Discovery | Query → organic results with URLs |
| Website Email Extractor | **V3** | Discovery | Domain → crawl pages → extract emails |
| Email Pattern Detector | **V3** | Discovery | Domain + name → detect pattern → generate emails |
| Auto-Extract Pipeline | **V3** | Discovery | Search → extract → verify → lead database (one-click) |
| Bulk Discovery Queue | **V3** | Discovery | Batch queries processed sequentially |
| Company Enrichment | **V3** | Enrichment | Domain → company size, industry, revenue, tech stack |
| Social Profile Linking | **V3** | Enrichment | Name + company → LinkedIn, Twitter profiles |
| Phone Number Finder | **V3** | Enrichment | Name + company → direct dial / mobile |
| A/B Testing | **V3** | Outreach | Split test any email step. Measure winner. |
| Conditional Branching | **V3** | Outreach | "If opened + no reply → send variant B" |
| Multi-Sender Rotation | **V3** | Outreach | Rotate 3-5 accounts per campaign |
| Email Warm-Up | **V3** | Outreach | Automated inbox warming network |
| Domain Health Monitor | **V3** | Outreach | SPF/DKIM/DMARC status, blacklist alerts |
| AI Email Writer | **V3** | AI | Lead data → personalized cold email draft |
| AI Subject Lines | **V3** | AI | Generate 5 subject line variants |
| AI Icebreaker | **V3** | AI | News/LinkedIn data → personalized opening line |
| AI Reply Classification | **V3** | AI | Auto-tag replies: Interested/OOO/Referral/etc. |
| ─── | ─── | ─── | ─── |
| Multi-User Workspaces | **V4** | Teams | Invite members, shared data |
| Role-Based Permissions | **V4** | Teams | Admin/Manager/Member access control |
| Lead Assignment | **V4** | Teams | Assign leads to reps, round-robin |
| Team Analytics | **V4** | Teams | Per-member performance metrics |
| White-Label Branding | **V4** | Agency | Custom logo, colors, domain |
| Sub-Accounts | **V4** | Agency | Isolated client workspaces |
| Agency Billing | **V4** | Agency | Wholesale pricing for agency clients |
| Client Reporting | **V4** | Agency | White-labeled PDF reports |
| LinkedIn Automation | **V4** | Multi-Channel | Auto-visit, connect, InMail sequences |
| SMS Integration | **V4** | Multi-Channel | Twilio-based SMS follow-ups |
| WhatsApp Integration | **V4** | Multi-Channel | Business API templated messages |
| AI Campaign Builder | **V4** | AI | One sentence → full campaign (ICP + list + sequence) |
| AI Lead Scoring (ML) | **V4** | AI | ML model trained on conversion data |
| Lookalike Finder | **V4** | AI | "Find more like my best clients" |
| Sequence Marketplace | **V4** | Marketplace | Share/sell email sequences |
| Form Template Marketplace | **V4** | Marketplace | Share/sell high-converting forms |
| GDPR Module | **V4** | Compliance | Consent tracking, right-to-erasure |
| Audit Logs | **V4** | Compliance | Full activity history |
| SSO/SAML | **V4** | Enterprise | Single sign-on for enterprise |
| Public API + Docs | **V4** | Enterprise | REST API with metered access |
| Advanced Form Analytics | **V4** | Enterprise | Form funnels, drop-off, A/B testing |

---

# SUMMARY: BUILD ORDER

| Version | Codename | Duration | Features | Revenue Target | Core Focus |
|---|---|---|---|---|---|
| **V1** | The Capture Engine | 5-7 weeks | 42 | $1K MRR | Lead capture + CRM integrations + lead management |
| **V2** | The Outreach Engine | 4-6 weeks | 28 | $5K MRR | Email verification + cold outreach + campaign analytics |
| **V3** | The Discovery Engine | 6-8 weeks | 20 | $15K MRR | Scraping + enrichment + advanced outreach + AI phase 1 |
| **V4** | The Empire | 8-12 weeks | 21 | $50K+ MRR | Teams + white-label + multi-channel + AI phase 2 + enterprise |

```
V1: CAPTURE IT    →  V2: REACH IT    →  V3: FIND MORE    →  V4: SCALE IT
(forms, badges,      (email sequences,   (scraping,           (teams, white-
 QR, CRM sync)        verification,       enrichment,          label, AI,
                       tracking)           AI writing)          enterprise)
```
