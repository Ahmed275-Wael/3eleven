# Manual Test — Password Reset Email Delivery

> **Cannot automate**: Requires live SMTP delivery + real email inbox.

## Prerequisites

1. Deployed (or local) instance running with real SMTP credentials
2. A verified account linked to a real email you can check
3. `.env` configured with live SMTP settings

## Steps

1. Navigate to /forgot-password
2. Enter the registered email address
3. Submit the form — should always show success message (even if email unknown)
4. Check inbox (and spam folder) — should receive email within 60 seconds
5. Email should contain:
   - Subject: "Reset your password" (or similar)
   - Body: a 6-digit numeric reset code (NOT a link)
   - From: the configured `SMTP_FROM` address
6. Enter the code on the reset form along with a new password
7. Old password should no longer work
8. New password should work
9. Try reusing the same reset code — should fail

## Expected Result

- Email arrives within 60 seconds
- Code is exactly 6 digits (not a clickable link)
- Reset flow completes successfully
- Old password invalidated
- Reset code is single-use

## Pass Criteria

- [ ] Email received in real inbox
- [ ] Code format correct (6-digit numeric, not a link)
- [ ] Password reset completes successfully
- [ ] Old password rejected after reset
- [ ] New password accepted
- [ ] Reset code rejected on second use
