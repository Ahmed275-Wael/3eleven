/**
 * Integration tests for auth routes — uses real DB, Redis, and SMTP via testcontainers.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestApp, type TestAppContext } from '../helpers/test-app';

describe('Auth Routes (Integration)', () => {
  let ctx: TestAppContext;

  const password = 'SecureP@ss123';
  let uniqueCounter = 0;

  function uniqueUser() {
    uniqueCounter++;
    return {
      username: `routeuser${uniqueCounter}`,
      email: `routeuser${uniqueCounter}@test.com`,
      password,
    };
  }

  beforeAll(async () => {
    ctx = await setupTestApp();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  });

  beforeEach(async () => {
    // Clean tables between tests
    await ctx.testDb.client.unsafe('DELETE FROM security_events');
    await ctx.testDb.client.unsafe('DELETE FROM users');
    await ctx.redis.flushdb();
    ctx.testSmtp.clearEmails();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 4.1 — Registration Route
  // ─────────────────────────────────────────────────────────────────────────
  describe('MODULE 4.1 — Registration Route', () => {
    it('POST /auth/register → 201 { userId, username, message }', async () => {
      const user = uniqueUser();
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: user,
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.userId).toBeDefined();
      expect(body.username).toBe(user.username.toLowerCase());
      expect(body.message).toBeDefined();
    });

    it('POST /auth/register → duplicate username → 409 USERNAME_TAKEN', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { ...user, email: 'other@test.com' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe('USERNAME_TAKEN');
    });

    it('POST /auth/register → duplicate email → 409 EMAIL_TAKEN', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { ...user, username: 'otherusername' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe('EMAIL_TAKEN');
    });

    it('POST /auth/register → invalid body → 400', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: 'ab', email: 'bad', password: '123' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('POST /auth/register → does NOT return passwordHash', async () => {
      const user = uniqueUser();
      const res = await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });
      const body = res.json();
      expect(body.passwordHash).toBeUndefined();
      expect(body.password_hash).toBeUndefined();
    });

    it('POST /auth/register → verification email is sent via SMTP', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });
      // Check that SMTP captured the email
      const emails = ctx.testSmtp.getEmails();
      expect(emails.length).toBe(1);
      expect(emails[0].to).toContain(user.email);
      expect(emails[0].data).toMatch(/\d{6}/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 4.2 — Email Verification Route
  // ─────────────────────────────────────────────────────────────────────────
  describe('MODULE 4.2 — Email Verification Route', () => {
    it('POST /auth/verify-email → { email, code } → 200 + Set-Cookie on success', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });
      const code = await ctx.redis.get(`verify:${user.email}`);
      expect(code).not.toBeNull();

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { email: user.email, code },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie']).toContain('HttpOnly');
    });

    it('POST /auth/verify-email → wrong code → 400 INVALID_CODE', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { email: user.email, code: '000000' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('INVALID_CODE');
    });

    it('POST /auth/verify-email → expired code → 400', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });
      // Simulate expiry by deleting key
      await ctx.redis.del(`verify:${user.email}`);

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { email: user.email, code: '123456' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('POST /auth/verify-email → already verified → 400 ALREADY_VERIFIED', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });
      const code = await ctx.redis.get(`verify:${user.email}`);
      await ctx.app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { email: user.email, code },
      });

      // Generate a new code to try again
      await ctx.redis.set(`verify:${user.email}`, '111111', 'EX', 900);
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { email: user.email, code: '111111' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('ALREADY_VERIFIED');
    });

    it('POST /auth/resend-verification → { email } → 200, new code sent', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });
      ctx.testSmtp.clearEmails();

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/resend-verification',
        payload: { email: user.email },
      });
      expect(res.statusCode).toBe(200);
      // New code should exist in Redis
      const code = await ctx.redis.get(`verify:${user.email}`);
      expect(code).not.toBeNull();
      // Resend must actually deliver an email
      const emails = ctx.testSmtp.getEmails();
      expect(emails.length).toBe(1);
      expect(emails[0].to).toContain(user.email);
    });

    it('POST /auth/resend-verification → already verified → 400 ALREADY_VERIFIED', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });
      const code = await ctx.redis.get(`verify:${user.email}`);
      await ctx.app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { email: user.email, code },
      });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/resend-verification',
        payload: { email: user.email },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('ALREADY_VERIFIED');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 4.3 — Login/Logout Route
  // ─────────────────────────────────────────────────────────────────────────
  describe('MODULE 4.3 — Login/Logout Route', () => {
    async function registerAndVerify(user: { username: string; email: string; password: string }) {
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });
      const code = await ctx.redis.get(`verify:${user.email}`);
      await ctx.app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { email: user.email, code },
      });
    }

    it('POST /auth/login → { username, password } → 200 + Set-Cookie', async () => {
      const user = uniqueUser();
      await registerAndVerify(user);

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: user.username, password: user.password },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('POST /auth/login → unverified → 403 EMAIL_NOT_VERIFIED', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: user.username, password: user.password },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe('EMAIL_NOT_VERIFIED');
    });

    it('POST /auth/login → wrong credentials → 401 INVALID_CREDENTIALS', async () => {
      const user = uniqueUser();
      await registerAndVerify(user);

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: user.username, password: 'wrongpassword' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('INVALID_CREDENTIALS');
    });

    it('POST /auth/login → missing fields → 400', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('POST /auth/logout → clears session + cookie → 200', async () => {
      const user = uniqueUser();
      await registerAndVerify(user);
      const loginRes = await ctx.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: user.username, password: user.password },
      });
      const cookie = loginRes.headers['set-cookie'];

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { cookie: typeof cookie === 'string' ? cookie : cookie![0] },
      });
      expect(res.statusCode).toBe(200);
    });

    it('POST /auth/logout → no session cookie → still 200 (idempotent)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/logout',
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 5.1 — Forgot Password Route
  // ─────────────────────────────────────────────────────────────────────────
  describe('MODULE 5.1 — Forgot Password Route', () => {
    it('POST /auth/forgot-password → { email } → always 200', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: user.email },
      });
      expect(res.statusCode).toBe(200);
    });

    it('POST /auth/forgot-password → nonexistent email → still 200 (no enumeration)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: 'nobody@test.com' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('POST /auth/forgot-password → missing email → 400', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE 5.2 — Reset Password Route
  // ─────────────────────────────────────────────────────────────────────────
  describe('MODULE 5.2 — Reset Password Route', () => {
    it('POST /auth/reset-password → { email, code, newPassword } → 200', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });

      // Request reset
      await ctx.app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: user.email },
      });
      const code = await ctx.redis.get(`reset:${user.email}`);
      expect(code).not.toBeNull();

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { email: user.email, code, newPassword: 'NewSecure123!' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('POST /auth/reset-password → invalid/expired code → 400 INVALID_CODE', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { email: user.email, code: '999999', newPassword: 'NewSecure123!' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('INVALID_CODE');
    });

    it('POST /auth/reset-password → weak password → 400 VALIDATION_ERROR', async () => {
      const user = uniqueUser();
      await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: user });
      await ctx.app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: user.email },
      });
      const code = await ctx.redis.get(`reset:${user.email}`);

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { email: user.email, code, newPassword: 'short' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
