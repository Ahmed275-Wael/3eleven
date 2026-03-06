import { test, expect } from '@playwright/test';
import Redis from 'ioredis';

const API = '/auth';

test.describe('E2E-1 — Full Registration → Email Verification → Login', () => {
  let redis: Redis;

  test.beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  });

  test.afterAll(async () => {
    await redis.quit();
  });

  test('signup → verify code → login → dashboard', async ({ request }) => {
    const email = `e2e_${Date.now()}@test.com`;
    const username = `e2euser${Date.now()}`;
    const password = 'SecureP@ss123';

    // Step 1: Register
    const regRes = await request.post(`${API}/register`, {
      data: { username, email, password },
    });
    expect(regRes.status()).toBe(201);
    const regBody = await regRes.json();
    expect(regBody.userId).toBeDefined();
    expect(regBody.username).toBe(username.toLowerCase());
    expect(regBody.passwordHash).toBeUndefined();

    // Step 2: Get verification code from Redis
    const code = await redis.get(`verify:${email}`);
    expect(code).not.toBeNull();
    expect(code).toMatch(/^\d{6}$/);

    // Step 3: Verify email
    const verifyRes = await request.post(`${API}/verify-email`, {
      data: { email, code },
    });
    expect(verifyRes.status()).toBe(200);
    // Should set a session cookie
    const setCookieHeader = verifyRes.headers()['set-cookie'];
    expect(setCookieHeader).toBeDefined();
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('Secure');

    // Step 4: Login with credentials
    const loginRes = await request.post(`${API}/login`, {
      data: { username, password },
    });
    expect(loginRes.status()).toBe(200);
    const loginCookie = loginRes.headers()['set-cookie'];
    expect(loginCookie).toBeDefined();
  });
});
