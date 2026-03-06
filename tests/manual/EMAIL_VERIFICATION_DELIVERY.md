# Manual Test — Email Verification Delivery

> **Cannot automate**: Requires live SMTP delivery + real email inbox.

## Prerequisites

1. Deployed (or local) instance running with real SMTP credentials
2. A real email inbox you can check (Gmail, Outlook, etc.)
3. `.env` configured with live SMTP settings

## Steps

1. Open registration form in browser
2. Register with a real email address you own
3. Check inbox (and spam folder) — should receive email within 60 seconds
4. Email should contain:
   - Subject: "Verify your email" (or similar)
   - Body: a 6-digit numeric code
   - From: the configured `SMTP_FROM` address
5. Enter the 6-digit code on the verification page
6. Account should be activated, session created, redirected to dashboard
7. Try requesting a second verification code (resend) — old code should be invalidated

## Expected Result

- Email arrives within 60 seconds
- Code is exactly 6 digits
- Code works on first try
- Old code is invalidated after resend
- Account transitions to verified state

## Pass Criteria

- [ ] Email received in real inbox
- [ ] Code format correct (6-digit numeric)
- [ ] Verification flow completes successfully
- [ ] Resend invalidates previous code
