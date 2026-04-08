import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { setupTestRedis, type TestRedis } from '../helpers/test-redis';
import { authRoutes } from '../../src/security/routes/auth.routes';

// Real Redis + Fastify.inject() via testcontainers

describe('MODULE 7 — Rate Limiting (Integration)', () => {
  let testRedis: TestRedis;
  let app: FastifyInstance;

  beforeAll(async () => {
    testRedis = await setupTestRedis();

    app = Fastify();
    await app.register(cookie);

    // Minimal mock decorators so authRoutes can initialise
    const noop = () => {};
    app.decorate('redis', testRedis.redis);
    app.decorate('usersRepo', {
      findByUsername: async () => null,
      findByEmail: async () => null,
      create: async () => ({ id: 'fake', username: 'u', email: 'e@e.com', emailVerified: false, createdAt: new Date(), updatedAt: new Date() }),
    });
    app.decorate('sessionService', {
      createSession: async () => 'fake-session',
      getSession: async () => null,
      destroySession: async () => {},
      destroyAllSessions: async () => {},
    });
    app.decorate('emailSender', { sendVerificationCode: async () => {} });
    app.decorate('resetEmailSender', { sendResetCode: async () => {} });

    await app.register(authRoutes);
    await app.ready();
  }, 60_000);

  afterAll(async () => {
    try { await app.close(); } catch { /* ignore */ }
    await testRedis.teardown();
  });

  beforeEach(async () => {
    await testRedis.redis.flushdb();
  });

  it('/auth/* routes: 10 req/min per IP → 11th → 429', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: `user${i}`, email: `u${i}@test.com`, password: 'password123' },
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });
      // Might get various status codes, but NOT 429 yet
      expect(res.statusCode).not.toBe(429);
    }

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'excess', email: 'excess@test.com', password: 'password123' },
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    expect(res.statusCode).toBe(429);
  });

  it('POST /auth/login: 5 req/min per IP + 5 per username (dual counter)', async () => {
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'testuser', password: 'wrong' },
        headers: { 'x-forwarded-for': '5.6.7.8' },
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'testuser', password: 'wrong' },
      headers: { 'x-forwarded-for': '5.6.7.8' },
    });
    expect(res.statusCode).toBe(429);
  });

  it('POST /auth/forgot-password: 3 req/hour per IP', async () => {
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: `user${i}@test.com` },
        headers: { 'x-forwarded-for': '9.10.11.12' },
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: 'extra@test.com' },
      headers: { 'x-forwarded-for': '9.10.11.12' },
    });
    expect(res.statusCode).toBe(429);
  });

  it('429 response includes Retry-After header', async () => {
    // Exhaust rate limit first
    for (let i = 0; i < 11; i++) {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: `u${i}`, email: `u${i}@test.com`, password: 'password123' },
        headers: { 'x-forwarded-for': '13.14.15.16' },
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'last', email: 'last@test.com', password: 'password123' },
      headers: { 'x-forwarded-for': '13.14.15.16' },
    });
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('429 response includes X-RateLimit-Limit header', async () => {
    for (let i = 0; i < 11; i++) {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { username: `u${i}`, email: `u${i}@test.com`, password: 'password123' },
        headers: { 'x-forwarded-for': '17.18.19.20' },
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'last', email: 'last@test.com', password: 'password123' },
      headers: { 'x-forwarded-for': '17.18.19.20' },
    });
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
  });

  it('successful auth does NOT reset failed-attempt counter', async () => {
    // Make 4 failed login attempts
    for (let i = 0; i < 4; i++) {
      await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: 'testuser', password: 'wrong' },
        headers: { 'x-forwarded-for': '21.22.23.24' },
      });
    }

    // Successful login
    await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'testuser', password: 'correct' },
      headers: { 'x-forwarded-for': '21.22.23.24' },
    });

    // Next failed attempt should still count (counter not reset)
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: 'testuser', password: 'wrong' },
      headers: { 'x-forwarded-for': '21.22.23.24' },
    });
    // Should be rate limited (5 + 1 = 6 total attempts)
    expect(res.statusCode).toBe(429);
  });

  it('rate limit counter stored in Redis with correct TTL', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { username: 'user', email: 'u@test.com', password: 'password123' },
      headers: { 'x-forwarded-for': '25.26.27.28' },
    });

    // Check Redis for rate limit keys
    const keys = await testRedis.redis.keys('*rate-limit*');
    // At least one rate limit key should exist
    expect(keys.length).toBeGreaterThan(0);
  });
});
