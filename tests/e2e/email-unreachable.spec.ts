import { test, expect } from '@playwright/test';
import Redis from 'ioredis';

const API = '/auth';

test.describe('E2E-2 — Unverified Account Blocked from Login', () => {
  let redis: Redis;

  test.beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  });

  test.afterAll(async () => {
    await redis.quit();
  });

  test('register without verifying → login blocked → verify → login succeeds', async ({ request }) => {
    const email = `unverified_${Date.now()}@test.com`;
    const username = `unverified${Date.now()}`;
    const password = 'SecureP@ss123';

    // Step 1: Register
    const regRes = await request.post(`${API}/register`, {
      data: { username, email, password },
    });
    expect(regRes.status()).toBe(201);

    // Step 2: Try to login without verifying → should be blocked
    const loginRes = await request.post(`${API}/login`, {
      data: { username, password },
    });
    expect(loginRes.status()).toBe(403);
    const loginBody = await loginRes.json();
    expect(loginBody.error).toContain('EMAIL_NOT_VERIFIED');

    // Step 3: Verify email
    const code = await redis.get(`verify:${email}`);
    expect(code).not.toBeNull();
    const verifyRes = await request.post(`${API}/verify-email`, {
      data: { email, code },
    });
    expect(verifyRes.status()).toBe(200);

    // Step 4: Login should now succeed
    const loginRes2 = await request.post(`${API}/login`, {
      data: { username, password },
    });
    expect(loginRes2.status()).toBe(200);
  });
});
