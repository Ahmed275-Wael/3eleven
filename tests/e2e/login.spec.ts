import { test, expect } from '@playwright/test';
import Redis from 'ioredis';

const API = '/auth';

// Helper: create and verify a user, returns credentials
async function createVerifiedUser(
  request: any,
  redis: Redis,
  suffix: string,
) {
  const email = `login_${suffix}_${Date.now()}@test.com`;
  const username = `lgn${suffix}${Date.now()}`;
  const password = 'SecureP@ss123';

  await request.post(`${API}/register`, {
    data: { username, email, password },
  });
  const code = await redis.get(`verify:${email}`);
  await request.post(`${API}/verify-email`, { data: { email, code } });

  return { username, email, password };
}

test.describe('E2E-3 — Expired Code → Resend → Verify', () => {
  let redis: Redis;

  test.beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  });

  test.afterAll(async () => {
    await redis.quit();
  });

  test('expired code fails → resend → new code works', async ({ request }) => {
    const email = `expired_${Date.now()}@test.com`;
    const username = `expired${Date.now()}`;
    const password = 'SecureP@ss123';

    // Register
    await request.post(`${API}/register`, {
      data: { username, email, password },
    });

    // Get original code, then delete it from Redis to simulate expiry
    const originalCode = await redis.get(`verify:${email}`);
    await redis.del(`verify:${email}`);

    // Try to verify with expired code → should fail
    const verifyRes = await request.post(`${API}/verify-email`, {
      data: { email, code: originalCode },
    });
    expect(verifyRes.status()).toBe(400);

    // Resend verification
    const resendRes = await request.post(`${API}/resend-verification`, {
      data: { email },
    });
    expect(resendRes.status()).toBe(200);

    // Get new code and verify
    const newCode = await redis.get(`verify:${email}`);
    expect(newCode).not.toBeNull();

    const verifyRes2 = await request.post(`${API}/verify-email`, {
      data: { email, code: newCode },
    });
    expect(verifyRes2.status()).toBe(200);
  });
});

test.describe('E2E-4 — Username Case-Insensitive Login', () => {
  let redis: Redis;

  test.beforeAll(async () => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  });

  test.afterAll(async () => {
    await redis.quit();
  });

  test('registered as johndoe → login with JohnDoe and JOHNDOE both succeed', async ({ request }) => {
    const { username, password } = await createVerifiedUser(request, redis, 'case');

    // Login with uppercase variant
    const loginUpper = await request.post(`${API}/login`, {
      data: { username: username.toUpperCase(), password },
    });
    expect(loginUpper.status()).toBe(200);

    // Login with mixed case
    const mixed = username.charAt(0).toUpperCase() + username.slice(1);
    const loginMixed = await request.post(`${API}/login`, {
      data: { username: mixed, password },
    });
    expect(loginMixed.status()).toBe(200);
  });
});
